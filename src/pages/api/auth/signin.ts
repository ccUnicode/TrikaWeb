import type { APIRoute } from 'astro';
import { getSupabase } from '../../../lib/auth';

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const supabase = getSupabase(cookies);
  const formData = await request.formData();
  const next = (formData.get('next') as string) || '/profile';
  
  const callbackUrl = new URL('/api/auth/callback', request.url);
  callbackUrl.searchParams.set('next', next);

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: callbackUrl.toString(),
      queryParams: {
        prompt: 'select_account',
      }
    },
  });

  if (error) {
    console.error('Error al iniciar sesion OAuth:', error);
    return redirect('/login?error=Error+al+conectar+con+Google');
  }

  // Redirigimos al usuario a la página de Google para que inicie sesión
  return redirect(data.url);
};
