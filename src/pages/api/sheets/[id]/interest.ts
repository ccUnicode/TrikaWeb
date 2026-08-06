export const prerender = false;
import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { sha256Hash, getDeviceId, getClientIP, enforceIpRateLimit } from '../../../../lib/utils';

// UUID v4 regex for device_id validation
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Shared validation for GET and POST:
 * - Validates sheet exists, is not hidden, and its course exists
 * - Checks that the sheet has no solution (solution_kind, solution_storage_path, solution_video_url)
 * - Validates device_id is a valid UUID
 * Returns the validated deviceId on success, or a Response on failure.
 */
async function validateRequest(
  sheetId: number,
  rawDeviceId: string | null,
): Promise<{ deviceId: string } | Response> {
  // Validate device_id format
  if (!rawDeviceId || !UUID_RE.test(rawDeviceId)) {
    return Response.json(
      { error: 'device_id inválido: se requiere un UUID v4' },
      { status: 400 },
    );
  }

  // Validate sheet: exists, visible, course exists, no solution
  const { data: sheetData, error: sheetError } = await supabaseAdmin
    .from('sheets')
    .select('id, is_hidden, solution_kind, solution_storage_path, solution_video_url, courses:course_id (code, is_hidden)')
    .eq('id', sheetId)
    .single();

  if (sheetError || !sheetData) {
    return Response.json({ error: 'Plancha no encontrada' }, { status: 404 });
  }

  // Sheet must be visible
  if ((sheetData as any).is_hidden) {
    return Response.json({ error: 'Plancha no disponible' }, { status: 404 });
  }

  // Course must exist and be visible
  const course = (sheetData as any).courses;
  if (!course || course.is_hidden) {
    return Response.json({ error: 'Curso no encontrado' }, { status: 404 });
  }

  // Must NOT already have a solution (check all solution fields)
  const hasSolution =
    sheetData.solution_kind ||
    sheetData.solution_storage_path ||
    sheetData.solution_video_url;

  if (hasSolution) {
    return Response.json(
      { error: 'Esta plancha ya tiene solucionario' },
      { status: 400 },
    );
  }

  return { deviceId: rawDeviceId };
}

// GET: Check if a device has expressed interest in a sheet
export const GET: APIRoute = async ({ params, url }) => {
  const sheetId = Number(params.id);
  if (!sheetId) {
    return Response.json({ error: 'ID inválido' }, { status: 400 });
  }

  const rawDeviceId = url.searchParams.get('device_id');
  const validation = await validateRequest(sheetId, rawDeviceId);
  if (validation instanceof Response) return validation;
  const { deviceId } = validation;

  const { data: existing, error } = await supabaseAdmin
    .from('sheet_interests')
    .select('id')
    .eq('sheet_id', sheetId)
    .eq('device_id', deviceId)
    .maybeSingle();

  if (error) {
    console.error('Error checking interest:', error);
    return Response.json({ error: 'Error interno' }, { status: 500 });
  }

  return Response.json({ interested: !!existing }, { status: 200 });
};

export const POST: APIRoute = async ({ params, request }) => {
  const sheetId = Number(params.id);
  if (!sheetId) {
    return Response.json({ error: 'ID inválido' }, { status: 400 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const rawDeviceId = getDeviceId(body);
  const validation = await validateRequest(sheetId, rawDeviceId);
  if (validation instanceof Response) return validation;
  const { deviceId } = validation;

  const clientIP = getClientIP(request);
  const ipHash = await sha256Hash(clientIP + import.meta.env.IP_SALT);

  const supa = supabaseAdmin;

  // Rate limiting
  const rate = await enforceIpRateLimit(supa, ipHash, 300);
  if (!rate.allowed) {
    if (rate.reason === 'rate_limit') {
      return Response.json({ error: 'Demasiadas operaciones desde esta IP' }, { status: 429 });
    }
    return Response.json({ error: 'Rate limit interno' }, { status: 500 });
  }

  // Atomic toggle via RPC (single round-trip, handles insert/delete + count update via trigger)
  const { data: result, error: rpcError } = await supa
    .rpc('toggle_sheet_interest', {
      p_sheet_id: sheetId,
      p_device_id: deviceId,
      p_ip_hash: ipHash,
    });

  if (rpcError) {
    console.error('Error in toggle_sheet_interest RPC:', rpcError);
    return Response.json(
      { error: 'Error al procesar interés' },
      { status: 500 },
    );
  }

  return Response.json({
    success: true,
    interested: result.interested,
    interest_count: result.interest_count,
  }, { status: 200 });
};
