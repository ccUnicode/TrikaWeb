export const prerender = false;
import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { sha256Hash, getDeviceId, getClientIP, enforceIpRateLimit } from '../../../../lib/utils';
// @ts-ignore
import moderationConfig from "../../../../../config/moderation.json";

const bannedWords = ((moderationConfig as any).bannedWords ?? []).map((w: string) => w.toLowerCase());

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

  const { stars, content } = body;

  if (!stars || stars < 1 || stars > 5) {
    return new Response(
      JSON.stringify({ error: 'stars debe ser 1-5' }),
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
  if (!deviceId) {
    return new Response(JSON.stringify({ error: 'Falta device_id' }), { status: 400 });
  }

  const clientIP = getClientIP(request);
  const ipHash = await sha256Hash(clientIP + import.meta.env.IP_SALT);

  const supa = supabaseAdmin;

  // Verificar que la plancha existe y es visible
  const { data: sheet } = await supa
    .from('sheets')
    .select('id, is_hidden')
    .eq('id', sheetId)
    .maybeSingle();

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
    .select('id')
    .eq('sheet_id', sheetId)
    .eq('device_id', deviceId)
    .maybeSingle();

  let error;

  if (existing) {
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
  const page = Number(url.searchParams.get('page') ?? 1);
  const pageSize = Number(url.searchParams.get('pageSize') ?? 10);

  const supa = supabaseAdmin;

  // Obtener feedback visible para esta plancha (con contenido no vacío)
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data: feedbackList, count, error: listError } = await supa
    .from('sheet_feedback')
    .select('id, stars, content, created_at', { count: 'exact', head: false })
    .eq('sheet_id', sheetId)
    .eq('is_hidden', false)
    .neq('content', '')
    .order('created_at', { ascending: false })
    .range(from, to);

  if (listError) {
    console.error('Error fetching sheet feedback:', listError);
    return new Response(
      JSON.stringify({
        error: 'Error al cargar comentarios: ' + listError.message,
        feedback: [],
        total: 0,
        page,
        pageSize,
        userFeedback: null,
      }),
      { status: 500 }
    );
  }

  // Filtrar null/empty content en memoria como respaldo
  const filteredList = (feedbackList ?? []).filter((f: any) => f.content && f.content.trim().length > 0);

  // Verificar si el device_id ya dejó feedback
  let userFeedback = null;
  if (deviceId) {
    const { data: existing } = await supa
      .from('sheet_feedback')
      .select('id, stars, content, created_at')
      .eq('sheet_id', sheetId)
      .eq('device_id', deviceId)
      .maybeSingle();

    userFeedback = existing || null;
  }

  return new Response(
    JSON.stringify({
      feedback: filteredList,
      total: count ?? 0,
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
  if (!deviceId) {
    return new Response(JSON.stringify({ error: 'Falta device_id' }), { status: 400 });
  }

  const supa = supabaseAdmin;

  const { data: existing } = await supa
    .from('sheet_feedback')
    .select('id')
    .eq('sheet_id', sheetId)
    .eq('device_id', deviceId)
    .maybeSingle();

  if (!existing) {
    return new Response(JSON.stringify({ error: 'No hay comentario para eliminar' }), { status: 404 });
  }

  const { error } = await supa
    .from('sheet_feedback')
    .delete()
    .eq('sheet_id', sheetId)
    .eq('device_id', deviceId);

  if (error) {
    console.error('Error al eliminar feedback:', error);
    return new Response(
      JSON.stringify({ error: 'Error al eliminar', details: error.message }),
      { status: 500 }
    );
  }

  return new Response(
    JSON.stringify({ success: true, deleted: true }),
    { status: 200 }
  );
};
