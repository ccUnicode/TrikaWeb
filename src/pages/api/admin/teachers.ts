export const prerender = false;

import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { validateAdminSession } from '../../../lib/adminAuth';

export const POST: APIRoute = async ({ request, cookies }) => {
    try {
        // Validate session from cookie
        const isValid = await validateAdminSession(cookies);
        if (!isValid) {
            return new Response(
                JSON.stringify({ ok: false, error: 'Sesión inválida' }),
                { status: 401, headers: { 'Content-Type': 'application/json' } }
            );
        }

        const body = await request.json();
        const { page = 1, pageSize = 20, search = '' } = body;

        const safePage = Math.max(1, Math.floor(Number(page) || 1));
        const safeSize = Math.min(50, Math.max(1, Math.floor(Number(pageSize) || 20)));
        const from = (safePage - 1) * safeSize;
        const to = from + safeSize - 1;

        // Build query - admin can see all teachers including hidden ones
        let query = supabaseAdmin
            .from('teachers')
            .select(
                `id, full_name, bio, avg_overall, rating_count, avatar_url, is_hidden,
         courses_teachers:courses_teachers ( courses:course_id (id, code, name) )`,
                { count: 'exact' }
            )
            .order('full_name', { ascending: true });

        // Apply search filter if provided
        if (search.trim()) {
            const pattern = `%${search.trim()}%`;
            query = query.or(`full_name.ilike.${pattern},bio.ilike.${pattern}`);
        }

        // Apply pagination
        query = query.range(from, to);

        const { data, count, error } = await query;

        if (error) {
            console.error('Error fetching teachers:', error);
            return new Response(
                JSON.stringify({ ok: false, error: 'Error al obtener profesores' }),
                { status: 500, headers: { 'Content-Type': 'application/json' } }
            );
        }

        // Format teachers data
        const teachers = (data || []).map((t: any) => ({
            id: t.id,
            full_name: t.full_name,
            bio: t.bio,
            avg_overall: t.avg_overall,
            rating_count: t.rating_count ?? 0,
            avatar_url: t.avatar_url,
            is_hidden: t.is_hidden ?? false,
            courses: (t.courses_teachers || [])
                .map((ct: any) => ct.courses)
                .filter(Boolean)
                .map((c: any) => ({ id: c.id, code: c.code, name: c.name })),
        }));

        const total = count ?? 0;
        const totalPages = total > 0 ? Math.ceil(total / safeSize) : 0;

        return new Response(
            JSON.stringify({
                ok: true,
                teachers,
                pagination: {
                    page: safePage,
                    pageSize: safeSize,
                    total,
                    totalPages,
                },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
    } catch (err) {
        console.error('teachers API error:', err);
        return new Response(
            JSON.stringify({ ok: false, error: 'Error interno del servidor' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }
};
