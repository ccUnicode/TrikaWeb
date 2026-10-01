export const prerender = false;

import type { APIRoute } from 'astro';
import { getUserSession } from '../../../lib/auth';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';

export const POST: APIRoute = async ({ request, cookies }) => {
  const { user, profile } = await getUserSession(cookies);

  if (!user || !profile) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401 });
  }

  try {
    const formData = await request.formData();
    const contributionId = formData.get('contribution_id');

    if (!contributionId) {
      return new Response(JSON.stringify({ error: 'Se requiere el ID del aporte' }), { status: 400 });
    }

    // 1. Verificar que el aporte pertenece al usuario y obtener su file_storage_path
    const { data: contrib, error: fetchError } = await supabaseAdmin
      .from('contributions')
      .select('id, file_storage_path, status')
      .eq('id', Number(contributionId))
      .eq('user_id', user.id)
      .maybeSingle();

    if (fetchError) {
      console.error('Error fetching contribution for deletion:', fetchError);
      return new Response(JSON.stringify({ error: 'Error al consultar el aporte' }), { status: 500 });
    }

    if (!contrib) {
      return new Response(JSON.stringify({ error: 'Aporte no encontrado o no tienes permisos para eliminarlo' }), { status: 404 });
    }

    if (contrib.status === 'pending' || contrib.status === 'rejected') {
      // Hard Delete: El usuario cancela o limpia basura
      const { error: deleteError } = await supabaseAdmin
        .from('contributions')
        .delete()
        .eq('id', contrib.id)
        .eq('user_id', user.id);

      if (deleteError) {
        console.error('Error deleting contribution row:', deleteError);
        return new Response(JSON.stringify({ error: 'Error al eliminar el aporte de la base de datos' }), { status: 500 });
      }

      // Eliminar el archivo del storage si existe
      if (contrib.file_storage_path && contrib.file_storage_path.trim() !== '') {
        const { error: storageError } = await supabaseAdmin.storage
          .from('contributions')
          .remove([contrib.file_storage_path]);

        if (storageError) {
          console.error('Error deleting draft file from storage:', storageError);
          // La fila ya fue eliminada, el archivo queda huérfano pero no bloqueamos
        }
      }
    } else if (contrib.status === 'approved') {
      // Soft Delete: Ocultamos el aporte del perfil del usuario, pero conservamos la data útil
      const { error: hideError } = await supabaseAdmin
        .from('contributions')
        .update({ hidden_by_user: true })
        .eq('id', contrib.id)
        .eq('user_id', user.id);

      if (hideError) {
        console.error('Error hiding approved contribution:', hideError);
        return new Response(JSON.stringify({ error: 'Error al ocultar el aporte del historial' }), { status: 500 });
      }
    }

    return new Response(JSON.stringify({ success: true, message: 'Aporte eliminado correctamente del historial' }), { status: 200 });

  } catch (err) {
    console.error('Unexpected error in delete contribution API:', err);
    return new Response(JSON.stringify({ error: 'Error interno en el servidor' }), { status: 500 });
  }
};
