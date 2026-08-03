export const prerender = false;
import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { sha256Hash, getDeviceId, getClientIP, enforceIpRateLimit } from '../../../../lib/utils';
// @ts-ignore
import moderationConfig from "../../../../../config/moderation.json";

const bannedWords = ((moderationConfig as any).bannedWords ?? []).map((w: string) => w.toLowerCase());
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

  const stars = body.stars;
  const content = typeof body.content === 'string' ? body.content.trim() : body.content;

  if (!stars || !Number.isInteger(stars) || stars < 1 || stars > 5) {
    return new Response(
      JSON.stringify({ error: 'stars debe ser un número entero entre 1 y 5' }),
      { status: 400 }
    );
  }

  if (!content || typeof content !== 'string' || content.length === 0) {
    return new Response(
      JSON.stringify({ error: 'El comentario de texto es obligatorio y no puede estar vacío' }),
      { status: 400 }
    );
  }

  if (content.length > 500) {
    return new Response(
      JSON.stringify({ error: 'El comentario no puede superar los 500 caracteres' }),
      { status: 400 }
    );
  }

  // Filtro de palabras prohibidas
  if (content) {
    const contentLower = content.toLowerCase();
    const foundBadWord = bannedWords.find((word: string) => contentLower.includes(word));
    if (foundBadWord) {
      return new Response(
        JSON.stringify({
          error: 'Tu comentario contiene lenguaje inapropiado y no puede ser publicado.'
        }),
        { status: 400 }
      );
    }
  }

  const deviceId = getDeviceId(body);
  if (!deviceId || !UUID_REGEX.test(deviceId)) {
    return new Response(JSON.stringify({ error: 'Falta device_id o formato inválido' }), { status: 400 });
  }

  const clientIP = getClientIP(request);
  const ipHash = await sha256Hash(clientIP + import.meta.env.IP_SALT);

  const supa = supabaseAdmin;

  // Verificar que la plancha existe y es visible
  const { data: sheet, error: sheetError } = await supa
    .from('sheets')
    .select('id, is_hidden')
    .eq('id', sheetId)
    .maybeSingle();

  if (sheetError) {
    console.error('Error fetching sheet in POST:', sheetError);
    return new Response(JSON.stringify({ error: 'Error interno verificando la plancha' }), { status: 500 });
  }

  if (!sheet || sheet.is_hidden) {
    return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });
  }

  // Rate limit por IP
  const rateLimit = await enforceIpRateLimit(supa, ipHash);
  if (!rateLimit.allowed) {
    if (rateLimit.reason === 'rate_limit') {
      return new Response(JSON.stringify({ error: 'Demasiados intentos desde esta IP' }), {
        status: 429
      });
    }
    console.error('Rate limit interno sheet feedback:', rateLimit.details);
    return new Response(JSON.stringify({ error: 'Rate limit interno' }), { status: 500 });
  }

  // Verificar si ya existe feedback de este device_id para esta plancha
  const { data: existing } = await supa
    .from('sheet_feedback')
    .select('id, stars, content')
    .eq('sheet_id', sheetId)
    .eq('device_id', deviceId)
    .maybeSingle();

  let error;

  if (existing) {
    // Evitar spam: si no cambió ni el contenido ni las estrellas, ignoramos el guardado
    if (existing.stars === stars && (existing.content || "") === (content || "")) {
      return new Response(
        JSON.stringify({ success: true, updated: false, message: "Sin cambios" }),
        { status: 200 }
      );
    }

    // Actualizar feedback existente
    const result = await supa
      .from('sheet_feedback')
      .update({
        stars,
        content: content || null,
        ip_hash: ipHash,
        is_hidden: false,
        needs_review: true,
        updated_at: new Date().toISOString()
      })
      .eq('sheet_id', sheetId)
      .eq('device_id', deviceId);

    error = result.error;
  } else {
    // Anti-spam: límite de comentarios por IP para esta plancha
    const { count, error: countError } = await supa
      .from('sheet_feedback')
      .select('id', { count: 'exact', head: true })
      .eq('sheet_id', sheetId)
      .eq('ip_hash', ipHash);

    if (countError) {
      console.error('Error verificando count IP:', countError);
      return new Response(JSON.stringify({ error: 'Error interno verificando seguridad' }), { status: 500 });
    }

    if (count !== null && count >= 3) {
      return new Response(
        JSON.stringify({ error: 'Se ha alcanzado el límite de comentarios desde esta red para esta plancha.' }),
        { status: 429 }
      );
    }

    // Insertar nuevo feedback
    const result = await supa
      .from('sheet_feedback')
      .insert({
        sheet_id: sheetId,
        device_id: deviceId,
        stars,
        content: content || null,
        ip_hash: ipHash,
        is_hidden: false,
        needs_review: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

    error = result.error;
  }

  if (error) {
    console.error('Error al guardar feedback:', error);
    return new Response(
      JSON.stringify({ error: 'Error al guardar', details: error.message }),
      { status: 500 }
    );
  }

  return new Response(
    JSON.stringify({ success: true, updated: !!existing }),
    { status: 200 }
  );
};

// GET: verificar si el usuario ya dejó feedback y obtener lista de feedback
export const GET: APIRoute = async ({ params, request }) => {
  const sheetId = Number(params.id);
  if (!sheetId) {
    return new Response(JSON.stringify({ error: 'ID inválido' }), { status: 400 });
  }

  const url = new URL(request.url);
  const deviceId = url.searchParams.get('device_id');
  if (deviceId && !UUID_REGEX.test(deviceId)) {
    return new Response(JSON.stringify({ error: 'Formato de device_id inválido' }), { status: 400 });
  }
  let page = Number(url.searchParams.get('page') ?? 1);
  let pageSize = Number(url.searchParams.get('pageSize') ?? 10);

  if (!Number.isInteger(page) || page < 1) {
    return new Response(JSON.stringify({ error: 'page debe ser un entero positivo' }), { status: 400 });
  }

  if (!Number.isInteger(pageSize) || pageSize < 1) {
    return new Response(JSON.stringify({ error: 'pageSize debe ser un entero positivo' }), { status: 400 });
  }

  if (pageSize > 50) pageSize = 50;

  const supa = supabaseAdmin;

  // Verificar que la plancha existe y es visible
  const { data: sheet, error: sheetError } = await supa
    .from('sheets')
    .select('id, is_hidden')
    .eq('id', sheetId)
    .maybeSingle();

  if (sheetError) {
    console.error('Error fetching sheet in GET:', sheetError);
    return new Response(JSON.stringify({ error: 'Error interno verificando la plancha' }), { status: 500 });
  }

  if (!sheet || sheet.is_hidden) {
    return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });
  }

  // Obtener feedback visible para esta plancha (con contenido no vacío)
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const feedbackPromise = supa
    .from('sheet_feedback')
    .select('id, stars, content, created_at', { count: 'exact', head: false })
    .eq('sheet_id', sheetId)
    .eq('is_hidden', false)
    .neq('content', '')
    .order('created_at', { ascending: false })
    .range(from, to);

  const userFeedbackPromise = deviceId
    ? supa
        .from('sheet_feedback')
        .select('id, stars, content, created_at')
        .eq('sheet_id', sheetId)
        .eq('device_id', deviceId)
        .maybeSingle()
    : Promise.resolve({ data: null, error: null });

  const avgStarsPromise = supa.rpc('get_average_stars', { p_sheet_id: sheetId });

  const [
    { data: feedbackList, count, error: listError },
    { data: existing, error: userError },
    { data: avgStars, error: avgError }
  ] = await Promise.all([
    feedbackPromise,
    userFeedbackPromise,
    avgStarsPromise
  ]);

  if (listError || (userError && deviceId) || avgError) {
    const combinedError = listError || (userError && deviceId ? userError : null) || avgError;
    console.error('Error fetching sheet feedback:', combinedError);
    return new Response(
      JSON.stringify({
        error: 'Error al cargar comentarios: ' + combinedError?.message,
        feedback: [],
        total: 0,
        page,
        pageSize,
        userFeedback: null,
      }),
      { status: 500 }
    );
  }

  const userFeedback = existing || null;
  const avgRating = avgStars ?? 0;

  return new Response(
    JSON.stringify({
      feedback: feedbackList ?? [],
      total: count ?? 0,
      avgRating,
      page,
      pageSize,
      userFeedback,
    }),
    { status: 200 }
  );
};

// DELETE: eliminar feedback propio
export const DELETE: APIRoute = async ({ params, request }) => {
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
  if (!deviceId || !UUID_REGEX.test(deviceId)) {
    return new Response(JSON.stringify({ error: 'Falta device_id o formato inválido' }), { status: 400 });
  }

  const supa = supabaseAdmin;

  const { data, error } = await supa
    .from('sheet_feedback')
    .delete()
    .eq('sheet_id', sheetId)
    .eq('device_id', deviceId)
    .select();

  if (error) {
    console.error('Error al eliminar feedback:', error);
    return new Response(
      JSON.stringify({ error: 'Error al eliminar', details: error.message }),
      { status: 500 }
    );
  }

  if (!data || data.length === 0) {
    return new Response(JSON.stringify({ error: 'No hay comentario para eliminar' }), { status: 404 });
  }

  return new Response(
    JSON.stringify({ success: true, deleted: true }),
    { status: 200 }
  );
};
