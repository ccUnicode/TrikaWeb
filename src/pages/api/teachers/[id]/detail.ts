export const prerender = false;
import type { APIRoute } from 'astro';
import { getTeacherDetail } from '../../../../lib/data';

export const GET: APIRoute = async ({ params, url }) => {
  const teacherId = Number(params.id);
  const page = Number(url.searchParams.get('page') ?? 1);
  const pageSize = Number(url.searchParams.get('pageSize') ?? 5);

  if (!teacherId) {
    return new Response(JSON.stringify({ error: 'id inválido' }), { status: 400 });
  }

  const detail = await getTeacherDetail(teacherId, page, pageSize);
  if (!detail) return new Response(JSON.stringify({ error: 'not found' }), { status: 404 });

  return new Response(JSON.stringify(detail), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
