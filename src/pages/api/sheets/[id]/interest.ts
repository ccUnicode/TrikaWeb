export const prerender = false;
import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { sha256Hash, getDeviceId, getClientIP, enforceIpRateLimit } from '../../../../lib/utils';

interface SheetAvailability {
  id: number;
  interest_count: number | null;
  solution_kind: string | null;
  solution_storage_path: string | null;
  solution_video_url: string | null;
}

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });

const parseSheetId = (value: string | undefined): number | null => {
  const sheetId = Number(value);

  return Number.isSafeInteger(sheetId) && sheetId > 0 ? sheetId : null;
};

/**
 * Obtiene una plancha visible cuyo curso también está visible.
 */
const getSheet = async (sheetId: number) => {
  return supabaseAdmin
    .from("sheets")
    .select(
      `
        id,
        interest_count,
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
 * Determina si la plancha ya cuenta con algún tipo de solucionario.
 */
const hasSolution = (sheet: SheetAvailability): boolean =>
  Boolean(
    sheet.solution_kind ||
    sheet.solution_storage_path ||
    sheet.solution_video_url,
  );

/**
 * GET /api/sheets/:id/interest?device_id=
 * Verifica si el dispositivo ya registró interés en el solucionario.
 *
 * POST /api/sheets/:id/interest
 * Registra o elimina el interés del dispositivo.
 *
 * El contador interest_count se mantiene sincronizado mediante un trigger
 * de PostgreSQL.
 */
export const GET: APIRoute = async ({ params, url }) => {
  const sheetId = parseSheetId(params.id);

  if (!sheetId) {
    return jsonResponse({ error: "ID inválido" }, 400);
  }

  const deviceId = url.searchParams.get("device_id")?.trim();

  if (!deviceId) {
    return jsonResponse({ error: "Falta device_id" }, 400);
  }

  const { data: sheet, error: sheetError } = await getSheet(sheetId);

  if (sheetError) {
    console.error("Error al validar la plancha:", sheetError);
    return jsonResponse({ error: "No se pudo procesar la solicitud" }, 500);
  }

  if (!sheet) {
    return jsonResponse({ error: "Plancha no disponible" }, 404);
  }

  if (hasSolution(sheet as SheetAvailability)) {
    return jsonResponse(
      { error: "La plancha ya cuenta con solucionario" },
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
    return jsonResponse({ error: "No se pudo procesar la solicitud" }, 500);
  }

  return jsonResponse({ interested: Boolean(existing) });
};

export const POST: APIRoute = async ({ params, request }) => {
  const sheetId = parseSheetId(params.id);

  if (!sheetId) {
    return jsonResponse({ error: "ID inválido" }, 400);
  }

  let body: Record<string, unknown>;

  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return jsonResponse({ error: "JSON inválido" }, 400);
  }

  const deviceId = getDeviceId(body);

  if (!deviceId) {
    return jsonResponse({ error: "Falta device_id" }, 400);
  }

  /*
   * Antes de registrar el interés, se valida que la plancha exista,
   * sea visible, pertenezca a un curso visible y todavía no tenga
   * solucionario.
   */
  const { data: sheet, error: sheetError } = await getSheet(sheetId);

  if (sheetError) {
    console.error("Error al validar la plancha:", sheetError);
    return jsonResponse({ error: "No se pudo procesar la solicitud" }, 500);
  }

  if (!sheet) {
    return jsonResponse({ error: "Plancha no disponible" }, 404);
  }

  const clientIP = getClientIP(request);
  const ipSalt = import.meta.env.IP_SALT;

  if (!ipSalt) {
    console.error("La variable de entorno IP_SALT no está configurada.");
    return jsonResponse({ error: "No se pudo procesar la solicitud" }, 500);
  }

  const ipHash = await sha256Hash(clientIP + ipSalt);
  const supa = supabaseAdmin;

  const rate = await enforceIpRateLimit(supa, ipHash, 300);

  if (!rate.allowed) {
    if (rate.reason === "rate_limit") {
      return jsonResponse(
        { error: "Demasiadas operaciones desde esta IP" },
        429,
      );
    }

    console.error("Error interno al aplicar el límite de solicitudes.");
    return jsonResponse({ error: "No se pudo procesar la solicitud" }, 500);
  }

  const { data: existing, error: existingError } = await supa
    .from("sheet_interests")
    .select("id")
    .eq("sheet_id", sheetId)
    .eq("device_id", deviceId)
    .maybeSingle();

  if (existingError) {
    console.error("Error al consultar el interés existente:", existingError);
    return jsonResponse({ error: "No se pudo procesar la solicitud" }, 500);
  }

  /*
   * Si todavía no existe un registro, solo se permite crearlo cuando
   * la plancha aún no cuenta con solucionario. Un registro existente
   * sí puede eliminarse mediante el toggle.
   */
  if (!existing && hasSolution(sheet as SheetAvailability)) {
    return jsonResponse(
      { error: "La plancha ya cuenta con solucionario" },
      409,
    );
  }

  const interested = !existing;

  if (existing) {
    const { error: deleteError } = await supa
      .from("sheet_interests")
      .delete()
      .eq("id", existing.id);

    if (deleteError) {
      console.error("Error al eliminar el interés:", deleteError);
      return jsonResponse({ error: "No se pudo procesar la solicitud" }, 500);
    }
  } else {
    const { error: insertError } = await supa.from("sheet_interests").insert({
      sheet_id: sheetId,
      device_id: deviceId,
      ip_hash: ipHash,
    });

    if (insertError) {
      console.error("Error al registrar el interés:", insertError);
      return jsonResponse({ error: "No se pudo procesar la solicitud" }, 500);
    }
  }

  /*
   * El trigger de la base de datos actualiza interest_count después del
   * INSERT o DELETE. Solo se consulta el valor resultante para responder.
   */
  const { data: updatedSheet, error: countError } = await supa
    .from("sheets")
    .select("interest_count")
    .eq("id", sheetId)
    .single();

  if (countError) {
    console.error("Error al obtener interest_count:", countError);
  }

  const previousCount = Number(
    (sheet as SheetAvailability).interest_count ?? 0,
  );

  const fallbackCount = Math.max(0, previousCount + (interested ? 1 : -1));

  const interestCount =
    updatedSheet?.interest_count !== null &&
    updatedSheet?.interest_count !== undefined
      ? Number(updatedSheet.interest_count)
      : fallbackCount;

  return jsonResponse({
    success: true,
    interested,
    interest_count: interestCount,
  });
};
