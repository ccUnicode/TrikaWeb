export const prerender = false;

import type { APIRoute } from 'astro';
import { getUserSession } from '../../../lib/auth';
import { USERNAME_PATTERN } from '../../../lib/authConstants';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';

export const PATCH: APIRoute = async ({ request, cookies }) => {
  const { user, profile } = await getUserSession(cookies);

  if (!user || !profile) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401 });
  }

  let body: { full_name?: string; username?: string | null };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'JSON inválido' }), { status: 400 });
  }

  const updates: Record<string, string | null> = {};

  if (typeof body.full_name === 'string') {
    const fullName = body.full_name.trim();
    if (fullName.length < 2 || fullName.length > 80) {
      return new Response(JSON.stringify({ error: 'El nombre debe tener entre 2 y 80 caracteres' }), {
        status: 400,
      });
    }
    updates.full_name = fullName;
  }

  if (body.username !== undefined) {
    if (body.username === null || body.username === '') {
      updates.username = null;
    } else {
      const username = body.username.trim();
      if (!USERNAME_PATTERN.test(username)) {
        return new Response(
          JSON.stringify({
            error: 'El nombre de usuario debe tener 3-30 caracteres (letras, números o _)',
          }),
          { status: 400 }
        );
      }
      updates.username = username;
    }
  }

  if (Object.keys(updates).length === 0) {
    return new Response(JSON.stringify({ error: 'No hay cambios para guardar' }), { status: 400 });
  }

  updates.updated_at = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .update(updates)
    .eq('id', user.id)
    .select('*')
    .single();

  if (error) {
    if (error.code === '23505') {
      return new Response(JSON.stringify({ error: 'Ese nombre de usuario ya está en uso' }), { status: 409 });
    }
    return new Response(JSON.stringify({ error: error.message }), { status: 400 });
  }

  return new Response(JSON.stringify({ success: true, profile: data }), { status: 200 });
};
