export const prerender = false;

import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { validateAdminSession } from '../../../lib/adminAuth';

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const isValid = await validateAdminSession(cookies);
    if (!isValid) {
      return new Response(JSON.stringify({ ok: false, error: 'Sesión inválida' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    }

    const body = await request.json();
    const page = Math.max(1, body.page || 1);
    const pageSize = Math.min(50, Math.max(1, body.pageSize || 10));

    const start = (page - 1) * pageSize;
    const end = start + pageSize - 1;

    const query = supabaseAdmin
      .from('study_plans')
      .select(`
        id,
        year,
        is_current,
        is_published,
        specialties (
          id,
          name
        ),
        plan_courses (count)
      `, { count: 'exact' });

    const { data: plans, error: fetchError, count } = await query
      .order('specialty_id', { ascending: true })
      .order('year', { ascending: false })
      .range(start, end);

    if (fetchError) throw fetchError;

    return new Response(JSON.stringify({
      ok: true,
      plans: plans,
      pagination: {
        total: count || 0,
        page,
        pageSize,
        totalPages: Math.ceil((count || 0) / pageSize)
      }
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });

  } catch (err: any) {
    console.error("Error fetching mallas:", err);
    return new Response(JSON.stringify({ ok: false, error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};
