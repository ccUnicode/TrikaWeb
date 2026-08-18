export const prerender = false;

import type { APIRoute } from 'astro';
import { validateAdminSession } from '../../../../lib/adminAuth';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';

export const GET: APIRoute = async ({ cookies }) => {
  const isAdmin = await validateAdminSession(cookies);
  if (!isAdmin) {
    return new Response(JSON.stringify({ error: 'No autorizado. Inicie sesión como admin.' }), { status: 401 });
  }

  try {
    const { data: contributions, error } = await supabaseAdmin
      .from('contributions')
      .select('*, courses(code, name)')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching contributions for admin:', error);
      return new Response(JSON.stringify({ error: 'Error obteniendo aportes de la base de datos' }), { status: 500 });
    }

    // Generar Signed URLs para poder descargar los borradores de forma segura en el admin
    const contributionsWithUrls = await Promise.all(
      contributions.map(async (contrib) => {
        if (!contrib.file_storage_path || contrib.file_storage_path === "") {
          return {
            ...contrib,
            signedUrl: null
          };
        }

        const { data } = await supabaseAdmin.storage
          .from('contributions')
          .createSignedUrl(contrib.file_storage_path, 3600); // 1 hora de validez
        
        return {
          ...contrib,
          signedUrl: data?.signedUrl ?? null
        };
      })
    );

    return new Response(JSON.stringify({ success: true, contributions: contributionsWithUrls }), { status: 200 });

  } catch (err) {
    console.error('Unexpected error in admin list contributions:', err);
    return new Response(JSON.stringify({ error: 'Error interno en el servidor' }), { status: 500 });
  }
};
