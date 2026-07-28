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

interface ToggleInterestResult {
  status: "ok" | "not_found" | "unavailable" | "solution_available";
  interested: boolean | null;
  interest_count: number | string | null;
}

/**
 * Formato UUID canónico aceptado por la columna uuid de PostgreSQL.
 *
 * No se restringe a una versión específica porque la base de datos
 * admite UUID de diferentes versiones.
 */
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

/**
 * Obtiene una plancha visible cuyo curso también está visible.
 *
 * Esta consulta se utiliza únicamente en GET. El POST realiza las
 * validaciones dentro de la función SQL para evitar condiciones
 * de carrera entre la validación y la modificación.
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
 * Determina si una plancha ya cuenta con algún tipo de solucionario.
 */
const hasSolution = (sheet: SheetAvailability): boolean =>
  Boolean(
    sheet.solution_kind?.trim() ||
    sheet.solution_storage_path?.trim() ||
    sheet.solution_video_url?.trim(),
  );

/**
 * GET /api/sheets/:id/interest?device_id=<uuid>
 *
 * Verifica si el dispositivo ya registró interés en el solucionario.
 */
export const GET: APIRoute = async ({ params, url }) => {
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
    console.error("Error al validar la plancha:", sheetError);

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

  const { data: existing, error: existingError } = await supabaseAdmin
    .from("sheet_interests")
    .select("id")
    .eq("sheet_id", sheetId)
    .eq("device_id", deviceId)
    .maybeSingle();

  if (existingError) {
    console.error("Error al consultar el interés:", existingError);

    return jsonResponse(
      {
        error: "No se pudo procesar la solicitud",
      },
      500,
    );
  }

  return jsonResponse({
    interested: Boolean(existing),
  });
};

/**
 * POST /api/sheets/:id/interest
 *
 * Alterna el interés del dispositivo mediante una función RPC.
 *
 * La consulta del estado actual, el INSERT o DELETE y la actualización
 * del contador se ejecutan dentro de una única transacción PostgreSQL.
 */
export const POST: APIRoute = async ({ params, request }) => {
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

  const clientIP = getClientIP(request);
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

  const ipHash = await sha256Hash(clientIP + ipSalt);

  const rate = await enforceIpRateLimit(supabaseAdmin, ipHash, 300);

  if (!rate.allowed) {
    if (rate.reason === "rate_limit") {
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
   * La función SQL bloquea la fila de sheets y realiza toda la
   * operación dentro de una única transacción.
   */
  const { data, error: toggleError } = await supabaseAdmin
    .rpc("toggle_sheet_interest", {
      p_sheet_id: sheetId,
      p_device_id: deviceId,
      p_ip_hash: ipHash,
    })
    .single();

  if (toggleError) {
    console.error("Error al alternar el interés:", toggleError);

    return jsonResponse(
      {
        error: "No se pudo procesar la solicitud",
      },
      500,
    );
  }

  const result = data as ToggleInterestResult | null;

  if (!result) {
    console.error("La función toggle_sheet_interest no devolvió resultado.");

    return jsonResponse(
      {
        error: "No se pudo procesar la solicitud",
      },
      500,
    );
  }

  switch (result.status) {
    case "not_found":
    case "unavailable":
      return jsonResponse(
        {
          error: "Plancha no disponible",
        },
        404,
      );

    case "solution_available":
      return jsonResponse(
        {
          error: "La plancha ya cuenta con solucionario",
        },
        409,
      );

    case "ok":
      break;

    default:
      console.error("Estado inesperado al alternar el interés:", result.status);

      return jsonResponse(
        {
          error: "No se pudo procesar la solicitud",
        },
        500,
      );
  }

  const interestCount = Number(result.interest_count);

  if (
    typeof result.interested !== "boolean" ||
    !Number.isSafeInteger(interestCount) ||
    interestCount < 0
  ) {
    console.error("Respuesta inválida de toggle_sheet_interest:", result);

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
};
