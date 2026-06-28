export const prerender = false;

import type { APIRoute } from 'astro';
import { supabaseClient } from '../../../lib/supabase.client';

export const GET: APIRoute = async ({ url, redirect }) => {
  const origin = url.origin;
  const redirectTo = `${origin}/api/auth/callback`;

  const { data, error } = await supabaseClient.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      queryParams: {
        hd: 'uni.pe',
        access_type: 'online',
        prompt: 'select_account',
      },
    },
  });

  if (error || !data.url) {
    const message = encodeURIComponent(error?.message ?? 'No se pudo iniciar sesión con Google');
    return redirect(`/login?error=oauth&msg=${message}`);
  }

  return redirect(data.url);
};
