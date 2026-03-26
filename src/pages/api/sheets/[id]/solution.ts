export const prerender = false;
import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

const admin = () =>
  createClient(import.meta.env.SUPABASE_URL!, import.meta.env.SUPABASE_SERVICE_KEY!);

export const GET: APIRoute = async ({ params }) => {
  const id = Number(params.id);
  const supa = admin();

  const { data: sheet } = await supa
    .from('sheets')
    .select('solution_kind, solution_storage_path, solution_video_url')
    .eq('id', id)
    .single();

  if (!sheet) return new Response('Not found', { status: 404 });

  if (sheet.solution_kind === 'pdf' && sheet.solution_storage_path) {
    const { data, error } = await supa.storage
      .from('solutions') // 👈 tu bucket
      .createSignedUrl(sheet.solution_storage_path, 120);
    if (error || !data?.signedUrl) return new Response('Sign error', { status: 500 });
    return Response.redirect(data.signedUrl, 302);
  }

  if (sheet.solution_kind === 'video' && sheet.solution_video_url) {
    return Response.redirect(sheet.solution_video_url, 302);
  }

  return new Response('No solution', { status: 404 });
};
