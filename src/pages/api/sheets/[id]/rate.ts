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
    return new Response(JSON.stringify({ error: 'JSON inválido' }), { status: 400 });
  }

  const { score } = body;
  if (!score || score < 1 || score > 5) {
    return new Response(
      JSON.stringify({ error: 'score debe ser 1-5' }), 
      { status: 400 }
    );
  }

  const deviceId = getDeviceId(body);
  if (!deviceId) {
    return new Response(JSON.stringify({ error: 'Falta device_id' }), { status: 400 });
  }

  const clientIP = getClientIP(request);
  const ipHash = await sha256Hash(clientIP + import.meta.env.IP_SALT);

  const supa = supabaseAdmin();

  // Verificar si ya existe un voto de este device_id
  const { data: existing } = await supa
    .from('sheet_ratings')
    .select('id')
    .eq('sheet_id', sheetId)
    .eq('device_id', deviceId)
    .maybeSingle();

  let error;

  if (existing) {
    // Si ya votó, ACTUALIZAR
    const result = await supa
      .from('sheet_ratings')
      .update({
        score,
        ip_hash: ipHash,
        created_at: new Date().toISOString()
      })
      .eq('sheet_id', sheetId)
      .eq('device_id', deviceId);
    
    error = result.error;
  } else {
    // Si es primera vez, INSERTAR
    const result = await supa
      .from('sheet_ratings')
      .insert({
        sheet_id: sheetId,
        device_id: deviceId,
        score,
        ip_hash: ipHash,
        created_at: new Date().toISOString()
      });
    
    error = result.error;
  }

  if (error) {
    console.error('Error al guardar rating:', error);
    return new Response(
      JSON.stringify({ error: 'Error al guardar', details: error.message }), 
      { status: 500 }
    );
  }

  // Calcular nuevo promedio
  const { data: stats } = await supa
    .from('sheet_ratings')
    .select('score')
    .eq('sheet_id', sheetId);

  if (stats) {
    const avg = stats.reduce((sum, r) => sum + r.score, 0) / stats.length;
    
    await supa
      .from('sheets')
      .update({
        avg_difficulty: Number(avg.toFixed(2)),
        rating_count: stats.length
      })
      .eq('id', sheetId);
  }

  return new Response(JSON.stringify({ success: true }), { status: 200 });
};