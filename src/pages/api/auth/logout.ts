import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ cookies, redirect }) => {
  cookies.delete('firebase_session', { path: '/' });
  
  return redirect('/login');
};
