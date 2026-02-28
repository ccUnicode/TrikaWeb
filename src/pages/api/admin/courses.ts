export const prerender = false;

import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { validateAdminSession } from '../../../lib/adminAuth';

export const POST: APIRoute = async ({ request, cookies }) => {
    try {
        const isValid = await validateAdminSession(cookies);
        if (!isValid) {
            return new Response(JSON.stringify({ ok: false, error: 'Sesión inválida' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        let body: any = {};
        try {
            body = await request.json();
        } catch {
            body = {};
        }

        const { page = 1, pageSize = 50, search = '' } = body;

        const safePage = Math.max(1, Math.floor(Number(page) || 1));
        const safeSize = Math.min(100, Math.max(1, Math.floor(Number(pageSize) || 50)));
        const from = (safePage - 1) * safeSize;
        const to = from + safeSize - 1;

        let query = supabaseAdmin
            .from('courses')
            .select('id, code, name, is_hidden', { count: 'exact' })
            .order('name', { ascending: true });

        if (String(search || '').trim()) {
            const pattern = `%${String(search).trim()}%`;
            query = query.or(`code.ilike.${pattern},name.ilike.${pattern}`);
        }

        const { data, count, error } = await query.range(from, to);

        if (error) {
            console.error('Error fetching courses:', error);
            return new Response(JSON.stringify({ ok: false, error: 'Error al obtener cursos' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const total = count ?? 0;
        const totalPages = total > 0 ? Math.ceil(total / safeSize) : 0;

        const courses = (data || []).map((c: any) => ({
            id: c.id,
            code: c.code,
            name: c.name,
            is_hidden: c.is_hidden ?? false,
        }));

        const visibleCount = courses.filter(c => !c.is_hidden).length;
        const hiddenCount = courses.filter(c => c.is_hidden).length;

        return new Response(
            JSON.stringify({
                ok: true,
                courses,
                counts: {
                    visible: visibleCount,
                    hidden: hiddenCount,
                },
                pagination: { page: safePage, pageSize: safeSize, total, totalPages },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
    } catch (err) {
        console.error('courses API error:', err);
        return new Response(JSON.stringify({ ok: false, error: 'Error interno del servidor' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
};
