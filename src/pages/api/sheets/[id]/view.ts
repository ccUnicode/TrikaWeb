export const prerender = false;
import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../../lib/supabase.server';
import { sha256Hash, getDeviceId, getClientIP } from '../../../../lib/utils';

export const POST: APIRoute = async ({ params, request }) => {
  const sheetId = Number(params.id);
  if (!sheetId) {
    return new Response(JSON.stringify({ error: 'ID inválido' }), { status: 400 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    body = {}; // Si no hay body, permitir registro sin device_id
  }

  const deviceId = getDeviceId(body); // Puede ser null

  const clientIP = getClientIP(request);
  const ipHash = await sha256Hash(clientIP + import.meta.env.IP_SALT);

  const supa = supabaseAdmin();

  // Cambio: usar "occured_at" y quitar "type" (no existe en tu tabla)
  const { error } = await supa
    .from('sheet_views')
    .insert({
      sheet_id: sheetId,
      device_id: deviceId,
      ip_hash: ipHash,
      occured_at: new Date().toISOString()
    });

  if (error) {
    console.error('Error al guardar view:', error);
    return new Response(
      JSON.stringify({ error: 'Error al guardar', details: error.message }), 
      { status: 500 }
    );
  }

  // Actualizar contador en sheets
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