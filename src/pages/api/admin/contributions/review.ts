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
    const action = String(formData.get('action') ?? '').trim();
    const adminNotes = String(formData.get('admin_notes') ?? '').trim();
    const uploadedFile = formData.get('file');

    if (!contributionIdRaw || (action !== 'approve' && action !== 'reject')) {
      return new Response(JSON.stringify({ error: 'Faltan parámetros requeridos (contribution_id, action)' }), { status: 400 });
    }

    const contributionId = Number(contributionIdRaw);
    if (isNaN(contributionId)) {
      return new Response(JSON.stringify({ error: 'ID de aporte inválido' }), { status: 400 });
    }

    // 1. Obtener los detalles del aporte actual
    const { data: contribution, error: fetchError } = await supabaseAdmin
      .from('contributions')
      .select('*, courses(code)')
      .eq('id', contributionId)
      .single();

    if (fetchError || !contribution) {
      return new Response(JSON.stringify({ error: 'Aporte no encontrado' }), { status: 404 });
    }

    if (contribution.status !== 'pending') {
      return new Response(JSON.stringify({ error: 'Este aporte ya ha sido procesado' }), { status: 400 });
    }

    const courseCode = contribution.courses?.code?.toUpperCase();
    if (!courseCode) {
      return new Response(JSON.stringify({ error: 'Código de curso no encontrado' }), { status: 400 });
    }

    const safeCycle = contribution.cycle.replace(/[^a-zA-Z0-9\-_]/g, '_');
    const safeExam = contribution.exam_type.replace(/[^a-zA-Z0-9\-_]/g, '_');
    
    // Obtener la extensión original del archivo del alumno
    const ext = contribution.file_storage_path.split('.').pop()?.toLowerCase() || 'pdf';
    const destinationFilename = `${safeCycle}.${ext}`;
    const destinationPath = `${courseCode}/${safeExam}/${destinationFilename}`;

    // 2. Procesar Rechazo
    if (action === 'reject') {
      const { error: rejectError } = await supabaseAdmin
        .from('contributions')
        .update({
          status: 'rejected',
          admin_notes: adminNotes || 'Rechazado por el administrador',
          updated_at: new Date().toISOString()
        })
        .eq('id', contributionId);

      if (rejectError) {
        console.error('Error rejecting contribution:', rejectError);
        return new Response(JSON.stringify({ error: 'Error actualizando el estado a rechazado' }), { status: 500 });
      }

      return new Response(JSON.stringify({ success: true, message: 'Aporte rechazado correctamente' }), { status: 200 });
    }

    // 3. Procesar Aprobación
    if (action === 'approve') {
      if (contribution.contribution_type === 'sheet') {
        // --- FLUJO PLANCHA (EXAMEN) ---
        // 3.1. Descargar el borrador del bucket 'contributions'
        const { data: fileData, error: downloadError } = await supabaseAdmin.storage
          .from('contributions')
          .download(contribution.file_storage_path);

        if (downloadError || !fileData) {
          console.error('Error downloading draft:', downloadError);
          return new Response(JSON.stringify({ error: 'No se pudo descargar el borrador de examen' }), { status: 500 });
        }

        // 3.2. Subir al bucket publico/privado 'exams'
        const buffer = Buffer.from(await fileData.arrayBuffer());
        
        let contentType = 'application/pdf';
        const originalExt = contribution.file_storage_path.split('.').pop()?.toLowerCase();
        if (originalExt === 'png') contentType = 'image/png';
        else if (originalExt === 'webp') contentType = 'image/webp';
        else if (originalExt === 'jpg' || originalExt === 'jpeg') contentType = 'image/jpeg';

        const { error: uploadError } = await supabaseAdmin.storage
          .from('exams')
          .upload(destinationPath, buffer, {
            contentType,
            upsert: true
          });

        if (uploadError) {
          console.error('Error uploading to exams:', uploadError);
          return new Response(JSON.stringify({ error: 'Error copiando el archivo a exámenes oficiales' }), { status: 500 });
        }

        // 3.3. Crear o actualizar la tabla 'sheets'
        const { data: existingSheet } = await supabaseAdmin
          .from('sheets')
          .select('id')
          .eq('course_id', contribution.course_id)
          .eq('cycle', contribution.cycle)
          .eq('exam_type', contribution.exam_type)
          .maybeSingle();

        if (existingSheet) {
          const { error: updateSheetError } = await supabaseAdmin
            .from('sheets')
            .update({
              exam_storage_path: destinationPath,
              is_hidden: false
            })
            .eq('id', existingSheet.id);

          if (updateSheetError) {
            console.error('Error updating sheets table:', updateSheetError);
            return new Response(JSON.stringify({ error: 'Error actualizando la tabla de planchas' }), { status: 500 });
          }
        } else {
          const { error: insertSheetError } = await supabaseAdmin
            .from('sheets')
            .insert({
              course_id: contribution.course_id,
              cycle: contribution.cycle,
              exam_type: contribution.exam_type,
              exam_storage_path: destinationPath,
              is_hidden: false
            });

          if (insertSheetError) {
            console.error('Error inserting into sheets table:', insertSheetError);
            return new Response(JSON.stringify({ error: 'Error registrando la plancha en la base de datos' }), { status: 500 });
          }
        }

      }

      // 3.4. Definir nota de retroalimentación por defecto según el tipo de aporte
      let finalNotes = adminNotes;
      if (!finalNotes) {
        if (contribution.contribution_type === 'solution') {
          finalNotes = '¡Muchas gracias por tu aporte! Se utilizará como guía para redactar y publicar la solución oficial tipeada.';
        } else {
          finalNotes = 'Aprobado y publicado correctamente. ¡Gracias por tu aporte!';
        }
      }

      // 3.5. Actualizar estado del aporte a 'approved'
      const { error: updateContributionError } = await supabaseAdmin
        .from('contributions')
        .update({
          status: 'approved',
          admin_notes: finalNotes,
          updated_at: new Date().toISOString()
        })
        .eq('id', contributionId);

      if (updateContributionError) {
        console.error('Error updating contribution status to approved:', updateContributionError);
        return new Response(JSON.stringify({ error: 'Error finalizando el registro del aporte' }), { status: 500 });
      }

      return new Response(JSON.stringify({ success: true, message: 'Aporte procesado correctamente' }), { status: 200 });
    }

    // Retorno fallback requerido por Astro Check si la acción no coincidió (aunque ya se validó al inicio)
    return new Response(JSON.stringify({ error: 'Acción inválida' }), { status: 400 });

  } catch (err: any) {
    console.error('Unexpected error in review API:', err);
    return new Response(JSON.stringify({ error: 'Error interno en el servidor' }), { status: 500 });
  }
};
