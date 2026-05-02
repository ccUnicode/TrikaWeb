export const prerender = false;
import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { sha256Hash, getDeviceId, getClientIP, enforceIpRateLimit } from '../../../../lib/utils';

// GET: Check if a device has expressed interest in a sheet
export const GET: APIRoute = async ({ params, url }) => {
  const sheetId = Number(params.id);
  if (!sheetId) {
    return new Response(JSON.stringify({ error: 'ID inválido' }), { status: 400 });
  }

  const deviceId = url.searchParams.get('device_id');
  if (!deviceId) {
    return new Response(JSON.stringify({ error: 'Falta device_id' }), { status: 400 });
  }

  const { data: existing, error } = await supabaseAdmin
    .from('sheet_interests')
    .select('id')
    .eq('sheet_id', sheetId)
    .eq('device_id', deviceId)
    .maybeSingle();

  if (error) {
    console.error('Error checking interest:', error);
    return new Response(
      JSON.stringify({ error: 'Error interno' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  return new Response(
    JSON.stringify({ interested: !!existing }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
};

export const POST: APIRoute = async ({ params, request }) => {
  const sheetId = Number(params.id);
  if (!sheetId) {
    return new Response(JSON.stringify({ error: 'ID inválido' }), { status: 400 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'JSON inválido' }), { status: 400 });
  }

  const deviceId = getDeviceId(body);
  if (!deviceId) {
    return new Response(JSON.stringify({ error: 'Falta device_id' }), { status: 400 });
  }

  const clientIP = getClientIP(request);
  const ipHash = await sha256Hash(clientIP + import.meta.env.IP_SALT);

  const supa = supabaseAdmin;

  // Rate limiting
  const rate = await enforceIpRateLimit(supa, ipHash, 300);
  if (!rate.allowed) {
    if (rate.reason === 'rate_limit') {
      return new Response(JSON.stringify({ error: 'Demasiadas operaciones desde esta IP' }), {
        status: 429
      });
    }
    return new Response(JSON.stringify({ error: 'Rate limit interno' }), { status: 500 });
  }

  // Check if already interested
  const { data: existing } = await supa
    .from('sheet_interests')
    .select('id')
    .eq('sheet_id', sheetId)
    .eq('device_id', deviceId)
    .maybeSingle();

  if (existing) {
    // Already interested → remove interest (toggle)
    const { error: deleteError } = await supa
      .from('sheet_interests')
      .delete()
      .eq('id', existing.id);

    if (deleteError) {
      console.error('Error al eliminar interés:', deleteError);
      return new Response(
        JSON.stringify({ error: 'Error al eliminar interés', details: deleteError.message }),
        { status: 500 }
      );
    }
  } else {
    // Not interested yet → register interest
    const { error: insertError } = await supa
      .from('sheet_interests')
      .insert({
        sheet_id: sheetId,
        device_id: deviceId,
        ip_hash: ipHash,
      });

    if (insertError) {
      console.error('Error al registrar interés:', insertError);
      return new Response(
        JSON.stringify({ error: 'Error al registrar interés', details: insertError.message }),
        { status: 500 }
      );
    }
  }

  // Update interest_count on sheets
  // Note: select-count + update is not atomic and has a minor race condition
  // under high concurrency. A DB trigger would be ideal but this is acceptable
  // for the current traffic level. The count self-corrects on each toggle.
  const { count } = await supa
    .from('sheet_interests')
    .select('*', { count: 'exact', head: true })
    .eq('sheet_id', sheetId);

  const interestCount = count ?? 0;

  const { error: updateError } = await supa
    .from('sheets')
    .update({ interest_count: interestCount })
    .eq('id', sheetId);

  if (updateError) {
    console.error('Error updating interest_count:', updateError);
    // Don't fail the request — the toggle itself succeeded, count is eventually consistent
  }

  return new Response(
    JSON.stringify({
      success: true,
      interested: !existing, // true if just added, false if just removed
      interest_count: interestCount,
    }),
    { status: 200 }
  );
};
