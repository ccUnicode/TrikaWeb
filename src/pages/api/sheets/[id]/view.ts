export const prerender = false;
import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { sha256Hash, getDeviceId, getClientIP, enforceIpRateLimit } from '../../../../lib/utils';

/**
 * POST /api/sheets/:id/view
 * Registra una vista o descarga de plancha en sheet_views.
 * Luego actualiza el contador view_count en la tabla sheets
 * consultando el conteo real de registros.
 * Aplica rate limiting con un límite más alto (120/h) por ser lectura.
 */
export const POST: APIRoute = async ({ params, request }) => {
  const sheetId = Number(params.id);
  if (!sheetId) {
    return new Response(JSON.stringify({ error: 'ID invalido' }), { status: 400 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'JSON invalido' }), { status: 400 });
  }

  const deviceId = getDeviceId(body);
  if (!deviceId) {
    return new Response(JSON.stringify({ error: 'Falta device_id' }), { status: 400 });
  }

  const rawType = typeof body.type === 'string' ? body.type.toLowerCase() : 'view';
  if (!['view', 'download'].includes(rawType)) {
    return new Response(JSON.stringify({ error: 'type invalido' }), { status: 400 });
  }

  const clientIP = getClientIP(request);
  const ipHash = await sha256Hash(clientIP + import.meta.env.IP_SALT);

  const supa = supabaseAdmin;

  const { data: sheet } = await supa
    .from('sheets')
    .select('id, is_hidden')
    .eq('id', sheetId)
    .maybeSingle();

  if (!sheet || sheet.is_hidden) {
    return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });
  }

  const rate = await enforceIpRateLimit(supa, ipHash, 120);
  if (!rate.allowed) {
    if (rate.reason === 'rate_limit') {
      return new Response(JSON.stringify({ error: 'Demasiadas operaciones desde esta IP' }), {
        status: 429
      });
    }
    console.error('Rate limit interno view:', rate.details);
    return new Response(JSON.stringify({ error: 'Rate limit interno' }), { status: 500 });
  }

  const { error } = await supa
    .from('sheet_views')
    .insert({
      sheet_id: sheetId,
      device_id: deviceId,
      ip_hash: ipHash,
      occurred_at: new Date().toISOString(),
      type: rawType
    });

  if (error) {
    console.error('Error al guardar view:', error);
    return new Response(
      JSON.stringify({ error: 'Error al guardar', details: error.message }),
      { status: 500 }
    );
  }

  const { count } = await supa
    .from('sheet_views')
    .select('*', { count: 'exact', head: true })
    .eq('sheet_id', sheetId);

  if (count !== null) {
    await supa
      .from('sheets')
      .update({ view_count: count })
      .eq('id', sheetId);
  }

  return new Response(JSON.stringify({ success: true }), { status: 200 });
};
