export const prerender = false;
import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { sha256Hash, getClientIP, enforceIpRateLimit } from '../../../../lib/utils';
import { getUserSession } from '../../../../lib/auth';
// @ts-ignore
import moderationConfig from "../../../../../config/moderation.json";

const bannedWords = ((moderationConfig as any).bannedWords ?? []).map((w: string) => w.toLowerCase());

/**
 * Crea o actualiza una calificación de profesor.
 * - Calcula el overall automáticamente como promedio de las 5 dimensiones.
 * - Valida contra palabras prohibidas (moderation.json).
 * - Aplica rate limiting por IP y límite de 3 votos por IP por profesor.
 * - Las calificaciones se crean visibles por defecto.
 */

export const POST: APIRoute = async ({ params, request, cookies }) => {
  const teacherId = Number(params.id);
  if (!teacherId) {
    return new Response(JSON.stringify({ error: 'ID inválido' }), { status: 400 });
  }

  const { user, profile } = await getUserSession(cookies);
  if (!user) {
    return new Response(
      JSON.stringify({ error: 'Debes iniciar sesión para realizar esta acción.' }),
      { status: 401 }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'JSON inválido' }), { status: 400 });
  }

  const { difficulty, didactic, resources, responsability, grading, comment, is_anonymous } = body;

  // Revisar por palabras no permitidas
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

  // Calcular overall automaticamente
  const overall = ratings.reduce((a, b) => a + b, 0) / ratings.length;

  const deviceId = user.id;
  const clientIP = getClientIP(request);
  const ipHash = await sha256Hash(clientIP + import.meta.env.IP_SALT);

  // Set anonymity logic (defaults to true if undefined or null)
  const isAnonymous = is_anonymous !== false;
  const userName = profile?.full_name || 'Estudiante';
  const userEmail = user.email || '';

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
        is_anonymous: isAnonymous,
        user_name: userName,
        user_email: userEmail,
        user_id: user.id,
        is_hidden: false, // Visible by default per user request (stars immediate)
        needs_review: true,
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
        is_anonymous: isAnonymous,
        user_name: userName,
        user_email: userEmail,
        user_id: user.id,
        is_hidden: false, // Visible by default per user request
        needs_review: true,
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
 * Verifica si el dispositivo ya calificó a este profesor.
 * Usado por el frontend para mostrar/ocultar el botón "Eliminar mi calificación".
 */
export const GET: APIRoute = async ({ params, cookies }) => {
  const teacherId = Number(params.id);
  if (!teacherId) {
    return new Response(JSON.stringify({ error: 'ID inválido' }), { status: 400 });
  }

  const { user } = await getUserSession(cookies);
  if (!user) {
    return new Response(
      JSON.stringify({
        hasVoted: false,
        rating: null
      }),
      { status: 200 }
    );
  }

  const deviceId = user.id;
  const supa = supabaseAdmin;

  const { data: existing } = await supa
    .from('teacher_ratings')
    .select('id, overall, difficulty, didactic, resources, responsability, grading, comment, is_anonymous, created_at')
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
 * Elimina la calificación del dispositivo para este profesor.
 * Verifica que exista antes de eliminar, luego retorna las stats actualizadas.
 */
export const DELETE: APIRoute = async ({ params, cookies }) => {
  const teacherId = Number(params.id);
  if (!teacherId) {
    return new Response(JSON.stringify({ error: 'ID inválido' }), { status: 400 });
  }

  const { user } = await getUserSession(cookies);
  if (!user) {
    return new Response(
      JSON.stringify({ error: 'Debes iniciar sesión para realizar esta acción.' }),
      { status: 401 }
    );
  }

  const deviceId = user.id;
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
