import type { APIRoute } from 'astro';
import { getSupabase } from '../../../lib/auth';

export const POST: APIRoute = async ({ cookies, redirect }) => {
  const supabase = getSupabase(cookies);
  await supabase.auth.signOut();
  
  return redirect('/login');
};
