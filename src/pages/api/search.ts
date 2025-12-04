export const prerender = false;
import type { APIRoute } from 'astro';
import { searchEntities } from '../../lib/data';

export const GET: APIRoute = async ({ url }) => {
  const query = url.searchParams.get('query') ?? url.searchParams.get('q') ?? '';
  const limitParam = url.searchParams.get('limit');
  const parsedLimit = limitParam ? Number(limitParam) : undefined;
  const limit = Number.isFinite(parsedLimit) ? parsedLimit : undefined;

  if (!query.trim()) {
    return new Response(JSON.stringify({ error: 'query requerido' }), { status: 400 });
  }

  try {
    const results = await searchEntities(query, limit);
    return new Response(JSON.stringify(results), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('search endpoint error', error);
    return new Response(JSON.stringify({ error: 'search_failed' }), { status: 500 });
  }
};

