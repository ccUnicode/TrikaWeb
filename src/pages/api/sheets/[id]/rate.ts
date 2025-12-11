export const prerender = false;
import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { sha256Hash, getDeviceId, getClientIP, enforceIpRateLimit } from '../../../../lib/utils';

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

  const supa = supabaseAdmin;

  const rateLimit = await enforceIpRateLimit(supa, ipHash);
  if (!rateLimit.allowed) {
    if (rateLimit.reason === 'rate_limit') {
      return new Response(JSON.stringify({ error: 'Demasiados intentos desde esta IP' }), {
        status: 429
      });
    }
    console.error('Rate limit interno sheet rate:', rateLimit.details);
    return new Response(JSON.stringify({ error: 'Rate limit interno' }), { status: 500 });
  }

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
    // Verificar límite de votos por IP para esta plancha (Anti-spam)
    const { count, error: countError } = await supa
      .from('sheet_ratings')
      .select('id', { count: 'exact', head: true })
      .eq('sheet_id', sheetId)
      .eq('ip_hash', ipHash);

    if (countError) {
      console.error('Error verificando count IP:', countError);
      return new Response(JSON.stringify({ error: 'Error interno verificando seguridad' }), { status: 500 });
    }

    if (count !== null && count >= 3) {
      return new Response(
        JSON.stringify({ error: 'Se ha alcanzado el límite de votos desde esta red para esta plancha.' }),
        { status: 429 }
      );
    }

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

  let responseStats: { avg_difficulty: number | null; rating_count: number } | null = null;
  const { data: stats } = await supa
    .from('sheets')
    .select('avg_difficulty, rating_count')
    .eq('id', sheetId)
    .single();

  if (stats) {
    responseStats = {
      avg_difficulty: stats.avg_difficulty,
      rating_count: stats.rating_count ?? 0
    };
  }

  return new Response(
    JSON.stringify({ success: true, stats: responseStats }),
    { status: 200 }
  );
};
