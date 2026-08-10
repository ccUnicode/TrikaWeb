export const prerender = false;

import type { APIRoute } from 'astro';
import { getUserSession } from '../../../lib/auth';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export const POST: APIRoute = async ({ request, cookies }) => {
  const { user } = await getUserSession(cookies);

  if (!user) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401 });
  }

  try {
    const formData = await request.formData();
    const specialty = String(formData.get('specialty') ?? '').trim();
    const file = formData.get('avatar');
    
    // Validar especialidad
    if (specialty) {
      const { data: validSpecialty, error: specError } = await supabaseAdmin
        .from('specialties')
        .select('name')
        .eq('name', specialty)
        .maybeSingle();
      if (!validSpecialty || specError) {
        return new Response(JSON.stringify({ error: 'Especialidad inválida' }), { status: 400 });
      }
    }

    // Obtener avatar actual
    const { data: currentProfile } = await supabaseAdmin
      .from('student_details')
      .select('avatar_url')
      .eq('user_id', user.id)
      .maybeSingle();
    const oldAvatarPath = currentProfile?.avatar_url && !currentProfile.avatar_url.startsWith('http') 
      ? currentProfile.avatar_url 
      : null;

    let avatarUrl = undefined;
    let uploadedPath: string | null = null;

    // Si hay archivo, subirlo al bucket avatars
    if (file && file instanceof File && file.size > 0) {
      if (!ALLOWED_TYPES.has(file.type)) {
        return new Response(JSON.stringify({ error: 'Formato de imagen no permitido. Usa JPG, PNG o WebP.' }), { status: 400 });
      }
      if (file.size > MAX_BYTES) {
        return new Response(JSON.stringify({ error: 'La foto no puede superar los 5 MB' }), { status: 400 });
      }

      // Asegurar que exista el bucket avatars (lo intentamos)
      const { data: bucket } = await supabaseAdmin.storage.getBucket('avatars');
      if (!bucket) {
        await supabaseAdmin.storage.createBucket('avatars', { public: true });
      }

      const sanitizedFilename = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const storagePath = `${user.id}/${Date.now()}_${sanitizedFilename}`;
      const buffer = Buffer.from(await file.arrayBuffer());

      const { error: uploadError } = await supabaseAdmin.storage
        .from('avatars')
        .upload(storagePath, buffer, {
          contentType: file.type,
          upsert: true,
        });

      if (uploadError) {
        console.error('Error al subir avatar:', uploadError);
        return new Response(JSON.stringify({ error: `Error subiendo foto: ${uploadError.message}` }), { status: 500 });
      }
      avatarUrl = storagePath;
      uploadedPath = storagePath;
    }

    // Preparar objeto de actualización
    const upsertData: any = {
      user_id: user.id,
      email: user.email || '',
      full_name: user.user_metadata?.full_name || 'Estudiante'
    };
    if (specialty) upsertData.specialty = specialty;
    if (avatarUrl) upsertData.avatar_url = avatarUrl;

    const { error: updateError } = await supabaseAdmin
      .from('student_details')
      .upsert(upsertData, { onConflict: 'user_id' });

      if (updateError) {
        console.error('Error al actualizar perfil:', updateError);
        if (uploadedPath) {
          await supabaseAdmin.storage.from('avatars').remove([uploadedPath]);
        }
        return new Response(JSON.stringify({ error: 'Error al actualizar el perfil en la base de datos' }), { status: 500 });
      }

      // Eliminar avatar anterior si se subió uno nuevo
      if (uploadedPath && oldAvatarPath && oldAvatarPath !== uploadedPath) {
        await supabaseAdmin.storage.from('avatars').remove([oldAvatarPath]);
      }

    return new Response(JSON.stringify({ success: true, avatarUrl, specialty }), { status: 200 });

  } catch (err: any) {
    console.error('Unexpected error in profile update API:', err);
    return new Response(JSON.stringify({ error: 'Error interno en el servidor' }), { status: 500 });
  }
};
