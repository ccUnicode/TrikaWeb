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
    .select('exam_storage_path')
    .eq('id', id)
    .single();

  if (!sheet?.exam_storage_path) return new Response('Not found', { status: 404 });

  const { data, error } = await supa.storage
    .from('exams') // 👈 tu bucket
    .createSignedUrl(sheet.exam_storage_path, 120);

  if (error || !data?.signedUrl) return new Response('Sign error', { status: 500 });
  return Response.redirect(data.signedUrl, 302);
};
