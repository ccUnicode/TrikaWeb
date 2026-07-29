export const prerender = false;

import type { APIRoute } from "astro";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import {
  sha256Hash,
  getDeviceId,
  getClientIP,
  enforceIpRateLimit,
} from "../../../../lib/utils";

interface SheetAvailability {
  id: number;
  solution_kind: string | null;
  solution_storage_path: string | null;
  solution_video_url: string | null;
}

type ToggleInterestStatus =
  | "INVALID_REQUEST"
  | "NOT_FOUND"
  | "HIDDEN"
  | "SOLUTION_AVAILABLE"
  | "REGISTERED"
  | "REMOVED";

interface ToggleInterestResult {
  status: ToggleInterestStatus;
  interested: boolean | null;
  interest_count: number | string | null;
  is_hidden: boolean | null;
  has_solution: boolean | null;
}

/**
 * Formato UUID canónico aceptado por la columna uuid de PostgreSQL.
 *
 * No se restringe a una versión específica porque PostgreSQL admite
 * UUID de diferentes versiones.
 */
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const TOGGLE_INTEREST_STATUSES: readonly ToggleInterestStatus[] = [
  "INVALID_REQUEST",
  "NOT_FOUND",
  "HIDDEN",
  "SOLUTION_AVAILABLE",
  "REGISTERED",
  "REMOVED",
];

const jsonResponse = (body: Record<string, unknown>, status = 200): Response =>
  Response.json(body, {
    status,
  });

const parseSheetId = (value: string | undefined): number | null => {
  const sheetId = Number(value);

  return Number.isSafeInteger(sheetId) && sheetId > 0 ? sheetId : null;
};

/**
 * Valida y normaliza un UUID.
 */
const normalizeUuid = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const normalizedValue = value.trim().toLowerCase();

  return UUID_PATTERN.test(normalizedValue) ? normalizedValue : null;
};

const isToggleInterestStatus = (
  value: unknown,
): value is ToggleInterestStatus =>
  typeof value === "string" &&
  TOGGLE_INTEREST_STATUSES.includes(value as ToggleInterestStatus);

/**
 * Valida la estructura JSON devuelta por toggle_sheet_interest.
 */
const parseToggleInterestResult = (
  value: unknown,
): ToggleInterestResult | null => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  const result = value as Record<string, unknown>;

  if (!isToggleInterestStatus(result.status)) {
    return null;
  }

  const interestCount =
    typeof result.interest_count === "number" ||
    typeof result.interest_count === "string"
      ? result.interest_count
      : null;

  return {
    status: result.status,
    interested:
      typeof result.interested === "boolean" ? result.interested : null,
    interest_count: interestCount,
    is_hidden: typeof result.is_hidden === "boolean" ? result.is_hidden : null,
    has_solution:
      typeof result.has_solution === "boolean" ? result.has_solution : null,
  };
};

/**
 * Obtiene una plancha visible cuyo curso también está visible.
 *
 * Esta consulta se utiliza únicamente en GET. El POST delega las
 * validaciones y la modificación a una función SQL transaccional.
 */
const getSheet = async (sheetId: number) => {
  return supabaseAdmin
    .from("sheets")
    .select(
      `
        id,
        solution_kind,
        solution_storage_path,
        solution_video_url,
        courses:course_id!inner(id)
      `,
    )
    .eq("id", sheetId)
    .eq("is_hidden", false)
    .eq("courses.is_hidden", false)
    .maybeSingle();
};

/**
 * Determina si una plancha cuenta con un solucionario válido.
 *
 * La validación debe coincidir con la utilizada dentro de la función
 * SQL toggle_sheet_interest.
 */
const hasSolution = (sheet: SheetAvailability): boolean => {
  const solutionKind = sheet.solution_kind?.trim().toLowerCase();

  const hasPdf =
    solutionKind === "pdf" && Boolean(sheet.solution_storage_path?.trim());

  const hasVideo =
    solutionKind === "video" && Boolean(sheet.solution_video_url?.trim());

  return hasPdf || hasVideo;
};

/**
 * GET /api/sheets/:id/interest?device_id=<uuid>
 *
 * Verifica si el dispositivo ya registró interés en el solucionario.
 */
export const GET: APIRoute = async ({ params, url }) => {
  try {
    const sheetId = parseSheetId(params.id);

    if (!sheetId) {
      return jsonResponse(
        {
          error: "ID inválido",
        },
        400,
      );
    }

    const rawDeviceId = url.searchParams.get("device_id");

    if (!rawDeviceId?.trim()) {
      return jsonResponse(
        {
          error: "Falta device_id",
        },
        400,
      );
    }

    const deviceId = normalizeUuid(rawDeviceId);

    if (!deviceId) {
      return jsonResponse(
        {
          error: "device_id debe tener formato UUID",
        },
        400,
      );
    }

    const { data: sheet, error: sheetError } = await getSheet(sheetId);

    if (sheetError) {
      console.error(
        "Error al validar la disponibilidad de la plancha:",
        sheetError,
      );

      return jsonResponse(
        {
          error: "No se pudo procesar la solicitud",
        },
        500,
      );
    }

    if (!sheet) {
      return jsonResponse(
        {
          error: "Plancha no disponible",
        },
        404,
      );
    }

    if (hasSolution(sheet as SheetAvailability)) {
      return jsonResponse(
        {
          error: "La plancha ya cuenta con solucionario",
        },
        409,
      );
    }

    const { data: existingInterest, error: existingInterestError } =
      await supabaseAdmin
        .from("sheet_interests")
        .select("id")
        .eq("sheet_id", sheetId)
        .eq("device_id", deviceId)
        .maybeSingle();

    if (existingInterestError) {
      console.error(
        "Error al consultar el interés de la plancha:",
        existingInterestError,
      );

      return jsonResponse(
        {
          error: "No se pudo procesar la solicitud",
        },
        500,
      );
    }

    return jsonResponse({
      interested: Boolean(existingInterest),
    });
  } catch (error) {
    console.error("Error inesperado en GET /api/sheets/:id/interest:", error);

    return jsonResponse(
      {
        error: "Error interno del servidor",
      },
      500,
    );
  }
};

/**
 * POST /api/sheets/:id/interest
 *
 * Alterna el interés de un dispositivo mediante una función RPC.
 *
 * La función SQL:
 * - Valida la existencia y disponibilidad de la plancha.
 * - Bloquea la fila correspondiente en sheets.
 * - Inserta o elimina el interés del dispositivo.
 * - Actualiza interest_count mediante un trigger.
 * - Ejecuta todos los cambios dentro de una transacción PostgreSQL.
 */
export const POST: APIRoute = async ({ params, request }) => {
  try {
    const sheetId = parseSheetId(params.id);

    if (!sheetId) {
      return jsonResponse(
        {
          error: "ID inválido",
        },
        400,
      );
    }

    let body: Record<string, unknown>;

    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return jsonResponse(
        {
          error: "JSON inválido",
        },
        400,
      );
    }

    const rawDeviceId = getDeviceId(body);

    if (!rawDeviceId) {
      return jsonResponse(
        {
          error: "Falta device_id",
        },
        400,
      );
    }

    const deviceId = normalizeUuid(rawDeviceId);

    if (!deviceId) {
      return jsonResponse(
        {
          error: "device_id debe tener formato UUID",
        },
        400,
      );
    }

    const ipSalt = import.meta.env.IP_SALT;

    if (!ipSalt) {
      console.error("La variable de entorno IP_SALT no está configurada.");

      return jsonResponse(
        {
          error: "No se pudo procesar la solicitud",
        },
        500,
      );
    }

    const clientIP = getClientIP(request);
    const ipHash = await sha256Hash(clientIP + ipSalt);

    const rateLimitResult = await enforceIpRateLimit(
      supabaseAdmin,
      ipHash,
      300,
    );

    if (!rateLimitResult.allowed) {
      if (rateLimitResult.reason === "rate_limit") {
        return jsonResponse(
          {
            error: "Demasiadas operaciones desde esta IP",
          },
          429,
        );
      }

      console.error("Error interno al aplicar el límite de solicitudes.");

      return jsonResponse(
        {
          error: "No se pudo procesar la solicitud",
        },
        500,
      );
    }

    /*
     * La RPC devuelve directamente un objeto JSON. No se utiliza
     * .single(), ya que no retorna una consulta tabular.
     */
    const { data, error: toggleError } = await supabaseAdmin.rpc(
      "toggle_sheet_interest",
      {
        p_sheet_id: sheetId,
        p_device_id: deviceId,
        p_ip_hash: ipHash,
      },
    );

    if (toggleError) {
      console.error("Error al alternar el interés de la plancha:", toggleError);

      return jsonResponse(
        {
          error: "No se pudo procesar la solicitud",
        },
        500,
      );
    }

    const result = parseToggleInterestResult(data);

    if (!result) {
      console.error("Respuesta inválida de toggle_sheet_interest:", data);

      return jsonResponse(
        {
          error: "No se pudo procesar la solicitud",
        },
        500,
      );
    }

    switch (result.status) {
      case "INVALID_REQUEST":
        return jsonResponse(
          {
            error: "Solicitud inválida",
          },
          400,
        );

      case "NOT_FOUND":
      case "HIDDEN":
        return jsonResponse(
          {
            error: "Plancha no disponible",
          },
          404,
        );

      case "SOLUTION_AVAILABLE":
        return jsonResponse(
          {
            error: "La plancha ya cuenta con solucionario",
          },
          409,
        );

      case "REGISTERED":
      case "REMOVED":
        break;

      default: {
        const exhaustiveStatus: never = result.status;

        console.error(
          "Estado inesperado al alternar el interés:",
          exhaustiveStatus,
        );

        return jsonResponse(
          {
            error: "No se pudo procesar la solicitud",
          },
          500,
        );
      }
    }

    const interestCount =
      result.interest_count === null
        ? Number.NaN
        : Number(result.interest_count);

    if (
      typeof result.interested !== "boolean" ||
      !Number.isSafeInteger(interestCount) ||
      interestCount < 0
    ) {
      console.error("Respuesta incompleta de toggle_sheet_interest:", result);

      return jsonResponse(
        {
          error: "No se pudo procesar la solicitud",
        },
        500,
      );
    }

    return jsonResponse({
      success: true,
      interested: result.interested,
      interest_count: interestCount,
    });
  } catch (error) {
    console.error("Error inesperado en POST /api/sheets/:id/interest:", error);

    return jsonResponse(
      {
        error: "Error interno del servidor",
      },
      500,
    );
  }
};
