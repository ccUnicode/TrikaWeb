import type { APIRoute } from 'astro';
import { getSupabase } from '../../../lib/auth';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';

export const GET: APIRoute = async ({ request, cookies, redirect }) => {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const next = requestUrl.searchParams.get('next') || '/profile';

  if (!code) {
    return redirect('/login?error=No+code+provided');
  }

  const supabase = getSupabase(cookies);
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    return redirect('/login?error=Error+en+autenticacion');
  }

  const email = data.user.email?.toLowerCase();
  if (!email || !email.endsWith('@uni.pe')) {
    await supabase.auth.signOut();
    return redirect('/login?error=Solo+se+permiten+correos+@uni.pe');
  }

  const { error: upsertError } = await supabaseAdmin
    .from('student_details')
    .upsert({
      user_id: data.user.id,
      email: email,
      full_name: data.user.user_metadata?.full_name || 'Estudiante',
      avatar_url: data.user.user_metadata?.avatar_url || null
    }, { onConflict: 'user_id' });

  if (upsertError) {
    console.error('Error creando perfil base del estudiante:', upsertError);
  }

  return redirect(next);
};
