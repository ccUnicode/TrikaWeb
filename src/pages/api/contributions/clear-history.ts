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
    // 1. Obtener todos los aportes del usuario para poder limpiar sus archivos del storage
    const { data: contributions, error: fetchError } = await supabaseAdmin
      .from('contributions')
      .select('id, file_storage_path')
      .eq('user_id', user.uid)
      .in('status', ['pending', 'rejected']);

    if (fetchError) {
      console.error('Error fetching contributions for deletion:', fetchError);
      return new Response(JSON.stringify({ error: 'Error al consultar los aportes' }), { status: 500 });
    }

    // 2. Eliminar todos los registros de aportes del usuario en la base de datos
    const { error: deleteError } = await supabaseAdmin
      .from('contributions')
      .delete()
      .eq('user_id', user.uid)
      .in('status', ['pending', 'rejected']);

    if (deleteError) {
      console.error('Error deleting contributions rows:', deleteError);
      return new Response(JSON.stringify({ error: 'Error al eliminar el historial de aportes de la base de datos' }), { status: 500 });
    }

    // 3. Si se eliminaron de la BD con éxito y tienen archivos asociados, eliminarlos del bucket
    if (contributions && contributions.length > 0) {
      const filePaths = contributions
        .map((c) => c.file_storage_path)
        .filter((path): path is string => typeof path === 'string' && path.trim() !== '');

      if (filePaths.length > 0) {
        const { error: storageError } = await supabaseAdmin.storage
          .from('contributions')
          .remove(filePaths);

        if (storageError) {
          console.error('Error deleting user draft files from storage:', storageError);
          // Al menos ya no bloqueamos la BD, aunque queden archivos huérfanos en Storage
        }
      }
    }

    return new Response(JSON.stringify({ success: true, message: 'Historial de aportes vaciado correctamente' }), { status: 200 });

  } catch (err) {
    console.error('Unexpected error in clear-history API:', err);
    return new Response(JSON.stringify({ error: 'Error interno en el servidor' }), { status: 500 });
  }
};
