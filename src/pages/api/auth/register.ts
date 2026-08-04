import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    return new Response(JSON.stringify({ error: 'El registro ahora se realiza con Google institucional' }), { status: 410 });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
};
