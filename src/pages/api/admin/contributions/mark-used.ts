export const prerender = false;

import type { APIRoute } from 'astro';
import { validateAdminSession } from '../../../../lib/adminAuth';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';

export const POST: APIRoute = async ({ request, cookies }) => {
  const isAdmin = await validateAdminSession(cookies);
  if (!isAdmin) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401 });
  }

  try {
    const formData = await request.formData();
    const contributionIdRaw = formData.get('contribution_id');

    if (!contributionIdRaw) {
      return new Response(JSON.stringify({ error: 'Falta ID de aporte' }), { status: 400 });
    }

    const contributionId = Number(contributionIdRaw);
    if (isNaN(contributionId)) {
      return new Response(JSON.stringify({ error: 'ID de aporte inválido' }), { status: 400 });
    }

    // 1. Obtener los detalles del aporte actual
    const { data: contribution, error: fetchError } = await supabaseAdmin
      .from('contributions')
      .select('*')
      .eq('id', contributionId)
      .single();

    if (fetchError || !contribution) {
      return new Response(JSON.stringify({ error: 'Aporte no encontrado' }), { status: 404 });
    }

    if (contribution.status !== 'approved') {
      return new Response(JSON.stringify({ error: 'Solo se pueden marcar como procesados los aportes aprobados' }), { status: 400 });
    }

    if (!contribution.file_storage_path) {
       return new Response(JSON.stringify({ error: 'Este aporte ya fue procesado y su archivo eliminado' }), { status: 400 });
    }

    // 2. Eliminar el archivo físico de Supabase Storage
    const { error: removeError } = await supabaseAdmin.storage
      .from('contributions')
      .remove([contribution.file_storage_path]);

    if (removeError) {
      console.error('Error removing draft from storage in mark-used:', removeError);
      return new Response(JSON.stringify({ error: 'Error al eliminar el archivo del servidor' }), { status: 500 });
    }

    // 3. Limpiar la ruta en la base de datos (mantiene el estado 'approved' para el alumno)
    const { error: updateError } = await supabaseAdmin
      .from('contributions')
      .update({
        file_storage_path: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', contributionId);

    if (updateError) {
      console.error('Error updating file_storage_path to null:', updateError);
      return new Response(JSON.stringify({ error: 'Archivo eliminado, pero falló la actualización en BD' }), { status: 500 });
    }

    return new Response(JSON.stringify({ success: true, message: 'Aporte procesado y limpiado correctamente' }), { status: 200 });

  } catch (err: any) {
    console.error('Unexpected error in mark-used API:', err);
    return new Response(JSON.stringify({ error: 'Error interno en el servidor' }), { status: 500 });
  }
};
