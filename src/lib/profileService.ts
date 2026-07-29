import type { User } from '@supabase/supabase-js';
import { supabaseAdmin } from './supabaseAdmin';
import type { UserProfile } from './auth';

function nameFromGoogleMetadata(user: User): string {
  const meta = user.user_metadata ?? {};
  const raw =
    meta.full_name ??
    meta.name ??
    meta.display_name ??
    user.email?.split('@')[0] ??
    'Estudiante';
  return String(raw).trim() || 'Estudiante';
}

function avatarFromGoogleMetadata(user: User): string | null {
  const meta = user.user_metadata ?? {};
  const url = meta.avatar_url ?? meta.picture ?? null;
  return typeof url === 'string' && url.length > 0 ? url : null;
}

export async function ensureStudentProfile(user: User): Promise<UserProfile | null> {
  const { data: existing, error: readError } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if (readError) {
    console.error('ensureStudentProfile read:', readError);
    return null;
  }

  const email = user.email?.toLowerCase() ?? '';
  const fullName = nameFromGoogleMetadata(user);
  const avatarUrl = avatarFromGoogleMetadata(user);

  // Ensure student_details row exists as well for the foreign key in teacher_ratings
  const { error: sdError } = await supabaseAdmin
    .from('student_details')
    .upsert({
      user_id: user.id,
      email: email,
      full_name: fullName,
      avatar_url: avatarUrl,
    }, { onConflict: 'user_id', ignoreDuplicates: true });

  if (sdError) {
    console.error('ensureStudentProfile student_details upsert error:', sdError);
  }

  if (existing) {
    return existing as UserProfile;
  }

  const insertRow = {
    id: user.id,
    email,
    full_name: fullName,
    username: null,
    avatar_url: avatarUrl,
    role: 'student' as const,
  };

  const { data: created, error: insertError } = await supabaseAdmin
    .from('profiles')
    .insert(insertRow)
    .select('*')
    .single();

  if (insertError) {
    console.error('ensureStudentProfile insert:', insertError);
    return null;
  }


  return created as UserProfile;
}
