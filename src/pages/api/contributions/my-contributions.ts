export const prerender = false;

import type { APIRoute } from 'astro';
import { getUserSession } from '../../../lib/auth';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';

export const GET: APIRoute = async ({ cookies }) => {
  const { user, profile } = await getUserSession(cookies);

  if (!user || !profile) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401 });
  }

  try {
    const { data: contributions, error } = await supabaseAdmin
      .from('contributions')
      .select('*, courses(code, name)')
      .eq('user_id', user.uid)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching student contributions:', error);
      return new Response(JSON.stringify({ error: 'Error cargando aportes de la base de datos' }), { status: 500 });
    }

    return new Response(JSON.stringify({ success: true, contributions }), { status: 200 });

  } catch (err) {
    console.error('Unexpected error in my-contributions:', err);
    return new Response(JSON.stringify({ error: 'Error interno en el servidor' }), { status: 500 });
  }
};
