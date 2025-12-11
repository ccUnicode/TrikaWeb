export const prerender = false;
import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../../lib/supabase.server';
import { sha256Hash, getDeviceId, getClientIP, enforceIpRateLimit } from '../../../../lib/utils';
// @ts-ignore
import moderationConfig from "../../../../../config/moderation.json";

const bannedWords = ((moderationConfig as any).bannedWords ?? []).map((w: string) => w.toLowerCase());

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

  // check for bad words
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

  // Calculate overall automatically
  const overall = ratings.reduce((a, b) => a + b, 0) / ratings.length;

  const deviceId = getDeviceId(body);
  if (!deviceId) {
    return new Response(JSON.stringify({ error: 'Falta device_id' }), { status: 400 });
  }

  const clientIP = getClientIP(request);
  const ipHash = await sha256Hash(clientIP + import.meta.env.IP_SALT);

  const supa = supabaseAdmin();

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

  // Verificar si ya existe
  const { data: existing } = await supa
    .from('teacher_ratings')
    .select('id')
    .eq('teacher_id', teacherId)
    .eq('device_id', deviceId)
    .maybeSingle();

  let error;

  // IMPORTANT: is_hidden is always true on write to enforce moderation
  if (existing) {
    // Actualizar
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
        is_hidden: true, // Forces re-moderation on update
        updated_at: new Date().toISOString()
      })
      .eq('teacher_id', teacherId)
      .eq('device_id', deviceId);

    error = result.error;
  } else {
    // Verificar límite de votos por IP para este profesor (Anti-spam)
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

    // Insertar
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
        is_hidden: true, // Hidden by default
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
