import { supabaseClient } from './supabase.client';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: 'student' | 'admin';
}

export async function getUserSession(cookies: any): Promise<{ user: any, profile: UserProfile | null }> {
  const accessToken = cookies.get('sb-access-token');
  const refreshToken = cookies.get('sb-refresh-token');

  if (!accessToken?.value || !refreshToken?.value) {
    return { user: null, profile: null };
  }

  try {
    const { data: { session }, error: sessionError } = await supabaseClient.auth.setSession({
      access_token: accessToken.value,
      refresh_token: refreshToken.value,
    });

    if (sessionError || !session?.user) {
      return { user: null, profile: null };
    }

    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single();

    if (profileError) {
      console.error('Error fetching profile:', profileError);
    }

    return { 
      user: session.user, 
      profile: profile as UserProfile 
    };
  } catch (err) {
    console.error('Unexpected error in getUserSession:', err);
    return { user: null, profile: null };
  }
}
