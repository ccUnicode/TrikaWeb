export const prerender = false;

import type { APIRoute } from 'astro';
import { getUserSession } from '../../../lib/auth';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';

export const POST: APIRoute = async ({ cookies }) => {
  const { user, profile } = await getUserSession(cookies);

  if (!user || !profile) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401 });
  }

  try {
    // 1. Obtener todos los aportes pendientes/rechazados del usuario para limpiar sus archivos del storage
    const { data: contributionsForDeletion, error: fetchError } = await supabaseAdmin
      .from('contributions')
      .select('id, file_storage_path')
      .eq('user_id', user.id)
      .in('status', ['pending', 'rejected']);

    if (fetchError) {
      console.error('Error fetching contributions for deletion:', fetchError);
      return new Response(JSON.stringify({ error: 'Error al consultar los aportes' }), { status: 500 });
    }

    // 2. Hard Delete: Eliminar registros de aportes pendientes/rechazados
    const { error: deleteError } = await supabaseAdmin
      .from('contributions')
      .delete()
      .eq('user_id', user.id)
      .in('status', ['pending', 'rejected']);

    if (deleteError) {
      console.error('Error deleting contributions rows:', deleteError);
      return new Response(JSON.stringify({ error: 'Error al eliminar el historial de aportes de la base de datos' }), { status: 500 });
    }

    // 3. Soft Delete: Ocultar los aprobados
    const { error: hideError } = await supabaseAdmin
      .from('contributions')
      .update({ hidden_by_user: true })
      .eq('user_id', user.id)
      .eq('status', 'approved');

    if (hideError) {
      console.error('Error hiding approved contributions rows:', hideError);
      return new Response(JSON.stringify({ error: 'Error al ocultar el historial de aportes aprobados' }), { status: 500 });
    }

    // 4. Limpiar archivos huérfanos del bucket
    if (contributionsForDeletion && contributionsForDeletion.length > 0) {
      const filePaths = contributionsForDeletion
        .map((c) => c.file_storage_path)
        .filter((path): path is string => typeof path === 'string' && path.trim() !== '');

      if (filePaths.length > 0) {
        const { error: storageError } = await supabaseAdmin.storage
          .from('contributions')
          .remove(filePaths);

        if (storageError) {
          console.error('Error deleting user draft files from storage:', storageError);
        }
      }
    }

    return new Response(JSON.stringify({ success: true, message: 'Historial de aportes vaciado correctamente' }), { status: 200 });

  } catch (err) {
    console.error('Unexpected error in clear-history API:', err);
    return new Response(JSON.stringify({ error: 'Error interno en el servidor' }), { status: 500 });
  }
};
