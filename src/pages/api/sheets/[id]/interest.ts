export const prerender = false;
import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { sha256Hash, getDeviceId, getClientIP, enforceIpRateLimit } from '../../../../lib/utils';

// GET: Check if a device has expressed interest in a sheet
export const GET: APIRoute = async ({ params, url }) => {
  const sheetId = Number(params.id);
  if (!sheetId) {
    return Response.json({ error: 'ID inválido' }, { status: 400 });
  }

  const deviceId = url.searchParams.get('device_id');
  if (!deviceId) {
    return Response.json({ error: 'Falta device_id' }, { status: 400 });
  }

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

  const deviceId = getDeviceId(body);
  if (!deviceId) {
    return Response.json({ error: 'Falta device_id' }, { status: 400 });
  }

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
      { error: 'Error al procesar interés', details: rpcError.message },
      { status: 500 }
    );
  }

  return Response.json({
    success: true,
    interested: result.interested,
    interest_count: result.interest_count,
  }, { status: 200 });
};
