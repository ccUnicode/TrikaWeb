export const prerender = false;

import type { APIRoute } from 'astro';
import { supabaseClient } from '../../../lib/supabase.client';
import { isUniPeEmail } from '../../../lib/authConstants';
import { ensureStudentProfile } from '../../../lib/profileService';
import { setAuthSessionCookies } from '../../../lib/sessionCookies';

export const GET: APIRoute = async ({ url, cookies, redirect }) => {
  const code = url.searchParams.get('code');
  const oauthError = url.searchParams.get('error_description') ?? url.searchParams.get('error');

  if (oauthError) {
    return redirect(`/login?error=oauth&msg=${encodeURIComponent(oauthError)}`);
  }

  if (!code) {
    return redirect('/login?error=auth');
  }

  const { data, error } = await supabaseClient.auth.exchangeCodeForSession(code);

  if (error || !data.session?.user) {
    console.error('Error en exchangeCodeForSession:', error);
    const message = encodeURIComponent(error?.message ?? 'No se pudo completar el inicio de sesión');
    return redirect(`/login?error=auth&msg=${message}`);
  }

  const user = data.session.user;
  const email = user.email?.toLowerCase();

  if (!isUniPeEmail(email)) {
    await supabaseClient.auth.signOut();
    return redirect('/login?error=dominio');
  }

  const profile = await ensureStudentProfile(user);
  if (!profile) {
    await supabaseClient.auth.signOut();
    return redirect('/login?error=perfil');
  }

  setAuthSessionCookies(cookies, data.session);
  return redirect('/profile');
};
