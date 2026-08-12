export const prerender = false;
import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { sha256Hash, getClientIP, enforceIpRateLimit } from '../../../../lib/utils';
import { getUserSession } from '../../../../lib/auth';
// @ts-ignore
import moderationConfig from "../../../../../config/moderation.json";

const bannedWords = ((moderationConfig as any).bannedWords ?? []).map((w: string) => w.toLowerCase());
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Valida que el parámetro sea un entero positivo y seguro para consultar como BIGINT. */
function parseSheetId(raw: string | undefined): number | null {
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || !Number.isSafeInteger(n)) return null;
  return n;
}

export const POST: APIRoute = async ({ params, request, cookies }) => {
  const sheetId = parseSheetId(params.id);
  if (sheetId === null) {
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

  const content = typeof body.content === 'string' ? body.content.trim() : body.content;
  const isAnonymous = body.is_anonymous === true;
  
  const userName = profile?.full_name || 'Estudiante';
  const userEmail = user.email || '';
  const userAvatar = profile?.avatar_url || '';
  const userId = user.id;

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

  const deviceId = user.id;
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

  // Límite de comentarios por IP para esta plancha (anti-spam general)
  const { count: ipCount, error: ipCountError } = await supa
    .from('sheet_feedback')
    .select('id', { count: 'exact', head: true })
    .eq('sheet_id', sheetId)
    .eq('ip_hash', ipHash);

  if (ipCountError) {
    console.error('Error verificando count IP:', ipCountError);
    return new Response(JSON.stringify({ error: 'Error interno verificando seguridad' }), { status: 500 });
  }

  if (ipCount !== null && ipCount >= 10) {
    return new Response(
      JSON.stringify({ error: 'Se ha alcanzado el límite de comentarios desde esta red para esta plancha.' }),
      { status: 429 }
    );
  }

  // Verificar si el usuario ya tiene 3 comentarios para esta plancha
  const { count: userCount, error: userCountError } = await supa
    .from('sheet_feedback')
    .select('id', { count: 'exact', head: true })
    .eq('sheet_id', sheetId)
    .eq('user_id', userId);

  if (userCountError) {
    console.error('Error verificando count de usuario:', userCountError);
    return new Response(JSON.stringify({ error: 'Error interno verificando comentarios del usuario' }), { status: 500 });
  }

  if (userCount !== null && userCount >= 3) {
    return new Response(
      JSON.stringify({ error: 'Has alcanzado el límite máximo de 3 comentarios por plancha.' }),
      { status: 429 }
    );
  }

  // Insertar nuevo feedback
  const result = await supa
    .from('sheet_feedback')
    .insert({
      sheet_id: sheetId,
      device_id: deviceId,
      content: content || null,
      ip_hash: ipHash,
      user_id: userId,
      user_name: userName,
      user_email: userEmail,
      user_avatar: userAvatar,
      is_anonymous: isAnonymous,
      is_hidden: false,
      needs_review: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .select('id')
    .single();

  let error = result.error;
  let insertedId = result.data?.id;

  if (error) {
    console.error('Error al guardar feedback:', error);
    return new Response(
      JSON.stringify({ error: 'Error al guardar', details: error.message }),
      { status: 500 }
    );
  }

  return new Response(
    JSON.stringify({ success: true, insertedId }),
    { status: 200 }
  );
};

// GET: verificar si el usuario ya dejó feedback y obtener lista de feedback
export const GET: APIRoute = async ({ params, request, cookies }) => {
  const sheetId = parseSheetId(params.id);
  if (sheetId === null) {
    return new Response(JSON.stringify({ error: 'ID inválido' }), { status: 400 });
  }

  const { user } = await getUserSession(cookies);
  const deviceId = user?.id || null;
  
  const url = new URL(request.url);
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
    .select('id, content, created_at, updated_at, user_name, is_anonymous, user_id, device_id, user_avatar', { count: 'exact', head: false })
    .eq('sheet_id', sheetId)
    .eq('is_hidden', false)
    .neq('content', '')
    .order('created_at', { ascending: false })
    .range(from, to);

  const { data: feedbackList, count, error: listError } = await feedbackPromise;

  if (listError) {
    console.error('Error fetching sheet feedback:', listError);
    return new Response(
      JSON.stringify({
        error: 'Error al cargar comentarios: ' + listError.message,
        feedback: [],
        total: 0,
        page,
        pageSize,
      }),
      { status: 500 }
    );
  }

  // Fetch reactions for the current page of feedback
  const feedbackIds = feedbackList?.map(f => f.id) || [];
  
  if (feedbackIds.length > 0) {
    const { data: reactionsData } = await supa
      .from('sheet_feedback_reactions')
      .select('feedback_id, reaction, user_id')
      .in('feedback_id', feedbackIds);

    feedbackList?.forEach((f: any) => {
      const fReactions = (reactionsData || []).filter(r => r.feedback_id === f.id);
      
      const counts: Record<string, number> = { like: 0, love: 0, haha: 0, wow: 0, sad: 0 };
      let userReaction = null;
      
      fReactions.forEach(r => {
        if (counts[r.reaction] !== undefined) {
          counts[r.reaction]++;
        }
        if (user?.id && r.user_id === user.id) {
          userReaction = r.reaction;
        }
      });
      
      f.reactions = counts;
      f.total_reactions = fReactions.length;
      f.user_reaction = userReaction;

      // Aplicar máscara de privacidad para comentarios anónimos
      // Solo el autor original podrá ver su propio user_id (para permitirle editar/borrar)
      if (f.is_anonymous && (!user || f.user_id !== user.id)) {
        f.user_name = 'Estudiante Anónimo';
        f.user_avatar = null;
        f.user_id = null;
        f.device_id = null;
      }
    });
  }

  return new Response(
    JSON.stringify({
      feedback: feedbackList ?? [],
      total: count ?? 0,
      page,
      pageSize,
    }),
    { status: 200 }
  );
};

// PUT: editar feedback propio (inline)
export const PUT: APIRoute = async ({ params, request, cookies }) => {
  const sheetId = parseSheetId(params.id);
  if (sheetId === null) {
    return new Response(JSON.stringify({ error: 'ID inválido' }), { status: 400 });
  }

  const { user, profile } = await getUserSession(cookies);
  if (!user) {
    return new Response(
      JSON.stringify({ error: 'Debes iniciar sesión para editar tu comentario.' }),
      { status: 401 }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'JSON inválido' }), { status: 400 });
  }

  const commentId = body.comment_id;
  const content = typeof body.content === 'string' ? body.content.trim() : body.content;
  const isAnonymous = body.is_anonymous === true;

  if (!commentId) {
    return new Response(JSON.stringify({ error: 'ID de comentario requerido' }), { status: 400 });
  }

  if (!content || typeof content !== 'string' || content.length === 0) {
    return new Response(JSON.stringify({ error: 'El comentario no puede estar vacío' }), { status: 400 });
  }

  if (content.length > 500) {
    return new Response(JSON.stringify({ error: 'El comentario no puede superar los 500 caracteres' }), { status: 400 });
  }

  const supa = supabaseAdmin;

  const { data, error } = await supa
    .from('sheet_feedback')
    .update({
      content,
      updated_at: new Date().toISOString()
    })
    .eq('id', commentId)
    .eq('user_id', user.id) // Solo puede editar si le pertenece
    .select();

  if (error) {
    console.error('Error al actualizar feedback:', error);
    return new Response(JSON.stringify({ error: 'Error al actualizar', details: error.message }), { status: 500 });
  }

  if (!data || data.length === 0) {
    return new Response(JSON.stringify({ error: 'No se pudo actualizar o el comentario no te pertenece' }), { status: 404 });
  }

  return new Response(JSON.stringify({ success: true, comment: data[0] }), { status: 200 });
};

// DELETE: eliminar feedback propio
export const DELETE: APIRoute = async ({ params, request, cookies }) => {
  const sheetId = parseSheetId(params.id);
  if (sheetId === null) {
    return new Response(JSON.stringify({ error: 'ID inválido' }), { status: 400 });
  }

  const { user } = await getUserSession(cookies);
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

  const commentId = body.comment_id;
  if (!commentId) {
    return new Response(JSON.stringify({ error: 'ID de comentario requerido' }), { status: 400 });
  }

  const supa = supabaseAdmin;

  const { data, error } = await supa
    .from('sheet_feedback')
    .delete()
    .eq('id', commentId)
    .eq('user_id', user.id) // Solo borrar si le pertenece al usuario logueado
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
