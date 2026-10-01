export const prerender = false;

import type { APIRoute } from 'astro';
import { getUserSession } from '../../../lib/auth';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp'
]);

const VALID_EXAM_TYPES = new Set([
  'PC1', 'PC2', 'PC3', 'PC4', 'PC5', 
  'Parcial', 'Final', 'Sustitutorio'
]);

// Valida formatos como 2024-I, 2024-II, 2024-III
const CYCLE_REGEX = /^20\d{2}-(I|II|III)$/;

export const POST: APIRoute = async ({ request, cookies }) => {
  const { user, profile } = await getUserSession(cookies);

  if (!user || !profile) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401 });
  }

  try {
    const formData = await request.formData();
    const courseIdRaw = formData.get('course_id');
    const cycle = String(formData.get('cycle') ?? '').trim();
    const examType = String(formData.get('exam_type') ?? '').trim();
    const contributionType = String(formData.get('contribution_type') ?? '').trim();
    const file = formData.get('file');

    if (!courseIdRaw || !cycle || !examType || !contributionType || !file) {
      return new Response(JSON.stringify({ error: 'Faltan campos requeridos' }), { status: 400 });
    }

    const courseId = Number(courseIdRaw);
    if (isNaN(courseId)) {
      return new Response(JSON.stringify({ error: 'ID de curso inválido' }), { status: 400 });
    }

    if (contributionType !== 'sheet' && contributionType !== 'solution') {
      return new Response(JSON.stringify({ error: 'Tipo de aporte inválido' }), { status: 400 });
    }

    if (!examType || examType.length > 50) {
      return new Response(JSON.stringify({ error: 'Tipo de evaluación inválido' }), { status: 400 });
    }

    if (!CYCLE_REGEX.test(cycle)) {
      return new Response(JSON.stringify({ error: 'Formato de ciclo inválido. Use el formato YYYY-I, YYYY-II o YYYY-III (ej. 2025-I)' }), { status: 400 });
    }

    if (!(file instanceof File)) {
      return new Response(JSON.stringify({ error: 'Se requiere un archivo (PDF o imagen)' }), { status: 400 });
    }

    if (!ALLOWED_TYPES.has(file.type)) {
      return new Response(JSON.stringify({ error: 'Formato no permitido. Usa PDF, JPG, PNG o WebP.' }), {
        status: 400,
      });
    }

    if (file.size > MAX_BYTES) {
      return new Response(JSON.stringify({ error: 'El archivo no puede superar los 10 MB' }), { status: 400 });
    }

    // --- Validaciones de no duplicidad ---

    // 1. Validar si ya hay un aporte PENDIENTE para la misma combinación
    const { data: pendingContrib } = await supabaseAdmin
      .from('contributions')
      .select('id, user_id')
      .eq('course_id', courseId)
      .eq('cycle', cycle)
      .ilike('exam_type', examType)
      .eq('contribution_type', contributionType)
      .eq('status', 'pending')
      .maybeSingle();

    if (pendingContrib) {
      const isMine = pendingContrib.user_id === user.id;
      return new Response(JSON.stringify({
        error: isMine
          ? `Ya tienes un aporte pendiente de revisión para ${examType} (${cycle}).`
          : `Ya existe un aporte en revisión enviado para ${examType} (${cycle}).`
      }), { status: 400 });
    }

    // 2. Si es una plancha (examen), validar si ya está aprobada o ya existe en el catálogo oficial
    if (contributionType === 'sheet') {
      // 2.1. Comprobar si ya existe un aporte aprobado en contributions
      const { data: approvedContrib } = await supabaseAdmin
        .from('contributions')
        .select('id')
        .eq('course_id', courseId)
        .eq('cycle', cycle)
        .ilike('exam_type', examType)
        .eq('contribution_type', 'sheet')
        .eq('status', 'approved')
        .maybeSingle();

      if (approvedContrib) {
        return new Response(JSON.stringify({
          error: `Ya existe una plancha aprobada para ${examType} (${cycle}) en este curso.`
        }), { status: 400 });
      }

      // 2.2. Comprobar si ya existe en la tabla oficial de 'sheets'
      let { data: existingSheet } = await supabaseAdmin
        .from('sheets')
        .select('id')
        .eq('course_id', courseId)
        .eq('cycle', cycle)
        .ilike('exam_type', examType)
        .maybeSingle();

      if (!existingSheet) {
        const { data: evalType } = await supabaseAdmin
          .from('evaluation_type')
          .select('evaluation_id')
          .or(`evaluation_abr.eq.${examType},evaluation_name.eq.${examType}`)
          .maybeSingle();

        if (evalType) {
          const { data: sheetByEval } = await supabaseAdmin
            .from('sheets')
            .select('id')
            .eq('course_id', courseId)
            .eq('cycle', cycle)
            .eq('evaluation_id', evalType.evaluation_id)
            .maybeSingle();
          existingSheet = sheetByEval;
        }
      }

      if (existingSheet) {
        return new Response(JSON.stringify({
          error: `Ya existe una plancha oficial publicada para ${examType} (${cycle}) en este curso.`
        }), { status: 400 });
      }
    } else if (contributionType === 'solution') {
      // 2.3. Si es un solucionario, comprobar si ya hay uno aprobado activo
      const { data: approvedSolution } = await supabaseAdmin
        .from('contributions')
        .select('id')
        .eq('course_id', courseId)
        .eq('cycle', cycle)
        .ilike('exam_type', examType)
        .eq('contribution_type', 'solution')
        .eq('status', 'approved')
        .not('file_storage_path', 'is', null)
        .maybeSingle();

      if (approvedSolution) {
        return new Response(JSON.stringify({
          error: `Ya existe un solucionario aprobado para ${examType} (${cycle}) en este curso.`
        }), { status: 400 });
      }
    }

    // Asegurar que el bucket privado 'contributions' exista
    const { data: bucket, error: bucketError } = await supabaseAdmin.storage.getBucket('contributions');
    if (bucketError || !bucket) {
      const { error: createBucketError } = await supabaseAdmin.storage.createBucket('contributions', {
        public: false,
        fileSizeLimit: MAX_BYTES
      });
      if (createBucketError) {
        console.error('Error creando bucket contributions:', createBucketError);
        return new Response(JSON.stringify({ error: 'Error configurando almacenamiento en el servidor' }), { status: 500 });
      }
    }

    // Limpiar nombre de archivo para evitar caracteres problemáticos
    const sanitizedFilename = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const storagePath = `${user.id}/${Date.now()}_${sanitizedFilename}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    // Subir al bucket contributions
    const { error: uploadError } = await supabaseAdmin.storage
      .from('contributions')
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      console.error('Error al subir archivo a contributions:', uploadError);
      return new Response(JSON.stringify({ error: `Error subiendo archivo: ${uploadError.message}` }), { status: 500 });
    }

    // Insertar en base de datos
    const { data: contribution, error: insertError } = await supabaseAdmin
      .from('contributions')
      .insert({
        user_id: user.id,
        user_email: user.email || '',
        user_name: profile.full_name || 'Estudiante',
        course_id: courseId,
        cycle,
        exam_type: examType,
        contribution_type: contributionType,
        file_storage_path: storagePath,
        status: 'pending',
      })
      .select('*')
      .single();

    if (insertError) {
      console.error('Error al insertar aporte:', insertError);
      // Eliminar el archivo subido si falla el registro de la BD
      await supabaseAdmin.storage.from('contributions').remove([storagePath]);
      return new Response(JSON.stringify({ error: `Error registrando el aporte: ${insertError.message}` }), { status: 500 });
    }

    return new Response(JSON.stringify({ success: true, contribution }), { status: 200 });

  } catch (err: any) {
    console.error('Unexpected error in contribution API:', err);
    return new Response(JSON.stringify({ error: 'Error interno en el servidor' }), { status: 500 });
  }
};
