export const prerender = false;
import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { sha256Hash, getDeviceId, getClientIP, enforceIpRateLimit } from '../../../../lib/utils';
// @ts-ignore
import moderationConfig from "../../../../../config/moderation.json";

const bannedWords = ((moderationConfig as any).bannedWords ?? []).map((w: string) => w.toLowerCase());

/**
 * POST /api/profesores/:id/rate
 * Crea o actualiza una calificación de profesor.
 * Flujo: modera palabras clave → valida campos 1-5 → calcula overall → rate-limit por IP → anti-spam (3 votos/IP) → upsert con is_hidden=false
 */
export const POST: APIRoute = async ({ params, request }) => {
  const teacherId = Number(params.id);
  if (!teacherId) {
    return new Response(JSON.stringify({ error: 'ID inválido' }), { status: 400 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'JSON inválido' }), { status: 400 });
  }

  const { difficulty, didactic, resources, responsability, grading, comment } = body;

  if (comment) {
    const commentLower = comment.toLowerCase();
    const foundBadWord = bannedWords.find((word: string) => commentLower.includes(word));
    if (foundBadWord) {
      return new Response(
        JSON.stringify({
          error: 'Tu comentario contiene lenguaje inapropiado y no puede ser publicado.'
        }),
        { status: 400 }
      );
    }
  }

  if (!difficulty || !didactic || !resources || !responsability || !grading) {
    return new Response(
      JSON.stringify({
        error: 'Faltan calificaciones (difficulty, didactic, resources, responsability, grading)'
      }),
      { status: 400 }
    );
  }

  const ratings = [difficulty, didactic, resources, responsability, grading];
  if (ratings.some(r => r < 1 || r > 5)) {
    return new Response(
      JSON.stringify({ error: 'Todas las calificaciones deben ser 1-5' }),
      { status: 400 }
    );
  }

  const overall = ratings.reduce((a, b) => a + b, 0) / ratings.length;

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
    console.error('Rate limit interno teacher rate:', rateLimit.details);
    return new Response(JSON.stringify({ error: 'Rate limit interno' }), { status: 500 });
  }

  const { data: existing } = await supa
    .from('teacher_ratings')
    .select('id')
    .eq('teacher_id', teacherId)
    .eq('device_id', deviceId)
    .maybeSingle();

  let error;

  if (existing) {
    const result = await supa
      .from('teacher_ratings')
      .update({
        ip_hash: ipHash,
        overall,
        difficulty,
        didactic,
        resources,
        responsability,
        grading,
        comment: comment || null,
        is_hidden: false,
        updated_at: new Date().toISOString()
      })
      .eq('teacher_id', teacherId)
      .eq('device_id', deviceId);

    error = result.error;
  } else {
    const { count, error: countError } = await supa
      .from('teacher_ratings')
      .select('id', { count: 'exact', head: true })
      .eq('teacher_id', teacherId)
      .eq('ip_hash', ipHash);

    if (countError) {
      console.error('Error verificando count IP:', countError);
      return new Response(JSON.stringify({ error: 'Error interno verificando seguridad' }), { status: 500 });
    }

    if (count !== null && count >= 3) {
      return new Response(
        JSON.stringify({ error: 'Se ha alcanzado el límite de votos desde esta red para este profesor.' }),
        { status: 429 }
      );
    }

    const result = await supa
      .from('teacher_ratings')
      .insert({
        ip_hash: ipHash,
        teacher_id: teacherId,
        device_id: deviceId,
        overall,
        difficulty,
        didactic,
        resources,
        responsability,
        grading,
        comment: comment || null,
        is_hidden: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
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

  const { data: stats } = await supa
    .from('teachers')
    .select('avg_overall, rating_count')
    .eq('id', teacherId)
    .single();

  return new Response(
    JSON.stringify({ success: true, stats }),
    { status: 200 }
  );
};

/**
 * GET /api/profesores/:id/rate?device_id=
 * Verifica si el dispositivo ya votó por este profesor.
 */
export const GET: APIRoute = async ({ params, request }) => {
  const teacherId = Number(params.id);
  if (!teacherId) {
    return new Response(JSON.stringify({ error: 'ID inválido' }), { status: 400 });
  }

  const url = new URL(request.url);
  const deviceId = url.searchParams.get('device_id');

  if (!deviceId) {
    return new Response(JSON.stringify({ error: 'Falta device_id' }), { status: 400 });
  }

  const supa = supabaseAdmin;

  const { data: existing } = await supa
    .from('teacher_ratings')
    .select('id, overall, difficulty, didactic, resources, responsability, grading, comment, created_at')
    .eq('teacher_id', teacherId)
    .eq('device_id', deviceId)
    .maybeSingle();

  return new Response(
    JSON.stringify({
      hasVoted: !!existing,
      rating: existing || null
    }),
    { status: 200 }
  );
};

/**
 * DELETE /api/profesores/:id/rate
 * Elimina la calificación del dispositivo.
 */
export const DELETE: APIRoute = async ({ params, request }) => {
  const teacherId = Number(params.id);
  if (!teacherId) {
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

  const supa = supabaseAdmin;

  const { data: existing } = await supa
    .from('teacher_ratings')
    .select('id')
    .eq('teacher_id', teacherId)
    .eq('device_id', deviceId)
    .maybeSingle();

  if (!existing) {
    return new Response(JSON.stringify({ error: 'No hay calificación para eliminar' }), { status: 404 });
  }

  const { error } = await supa
    .from('teacher_ratings')
    .delete()
    .eq('teacher_id', teacherId)
    .eq('device_id', deviceId);

  if (error) {
    console.error('Error al eliminar calificación:', error);
    return new Response(
      JSON.stringify({ error: 'Error al eliminar', details: error.message }),
      { status: 500 }
    );
  }

  const { data: stats } = await supa
    .from('teachers')
    .select('avg_overall, rating_count')
    .eq('id', teacherId)
    .single();

  return new Response(
    JSON.stringify({ success: true, deleted: true, stats }),
    { status: 200 }
  );
};
