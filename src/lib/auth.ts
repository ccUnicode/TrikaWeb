import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { supabaseAdmin } from './supabaseAdmin';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  avatar_url?: string;
  role: 'student' | 'admin';
}

export const getSupabase = (cookies: any) => {
  return createServerClient(
    import.meta.env.PUBLIC_SUPABASE_URL!,
    import.meta.env.PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(key: string) {
          return cookies.get(key)?.value;
        },
        set(key: string, value: string, options: CookieOptions) {
          cookies.set(key, value, options);
        },
        remove(key: string, options: CookieOptions) {
          cookies.delete(key, options);
        },
      },
    }
  );
};

export async function getUserSession(cookies: any): Promise<{ user: any, profile: UserProfile | null }> {
  try {
    const supabase = getSupabase(cookies);
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { user: null, profile: null };
    }

    const email = user.email?.toLowerCase();
    if (!email || !email.endsWith('@uni.pe')) {
      return { user: null, profile: null };
    }

    const { data: studentDetails } = await supabaseAdmin
      .from('student_details')
      .select('full_name, avatar_url')
      .eq('user_id', user.id)
      .maybeSingle();

    let finalAvatarUrl = studentDetails?.avatar_url || user.user_metadata?.avatar_url;
    if (finalAvatarUrl && !finalAvatarUrl.startsWith('http')) {
      const cleanSrc = finalAvatarUrl.replace(/^\/+/, '');
      finalAvatarUrl = `${import.meta.env.PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${cleanSrc}`;
    }

    const profile: UserProfile = {
      id: user.id,
      email,
      full_name: studentDetails?.full_name || user.user_metadata?.full_name || 'Estudiante',
      avatar_url: finalAvatarUrl,
      role: 'student',
    };

    return { 
      user, 
      profile 
    };
  } catch (err) {
    console.error('Unexpected error in getUserSession:', err);
    return { user: null, profile: null };
  }
}
