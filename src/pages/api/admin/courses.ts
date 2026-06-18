export const prerender = false;

import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { validateAdminSession } from '../../../lib/adminAuth';

export const POST: APIRoute = async ({ request, cookies }) => {
    try {
        const isValid = await validateAdminSession(cookies);
        if (!isValid) {
            return Response.json({ ok: false, error: 'Sesión inválida' }, { status: 401 });
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
            .select('id, code, name, credits, is_hidden', { count: 'exact' })
            .order('name', { ascending: true });

        if (String(search || '').trim()) {
            const pattern = `%${String(search).trim()}%`;
            query = query.or(`code.ilike.${pattern},name.ilike.${pattern}`);
        }

        const [coursesResult, visibleCountRes, hiddenCountRes] = await Promise.all([
            query.range(from, to),
            supabaseAdmin.from('courses').select('*', { count: 'exact', head: true }).eq('is_hidden', false),
            supabaseAdmin.from('courses').select('*', { count: 'exact', head: true }).eq('is_hidden', true)
        ]);

        const { data, count, error } = coursesResult;

        if (error) {
            console.error('Error fetching courses:', error);
            return Response.json({ ok: false, error: 'Error al obtener cursos' }, { status: 500 });
        }

        if (visibleCountRes.error || hiddenCountRes.error) {
            console.error('Error fetching course counts:', visibleCountRes.error || hiddenCountRes.error);
        }

        const total = count ?? 0;
        const totalPages = total > 0 ? Math.ceil(total / safeSize) : 0;

        const courses = (data || []).map((c: any) => ({
            id: c.id,
            code: c.code,
            name: c.name,
            credits: c.credits ?? 0,
            is_hidden: c.is_hidden ?? false,
        }));

        const visibleCount = visibleCountRes.count ?? 0;
        const hiddenCount = hiddenCountRes.count ?? 0;

        return Response.json({
            ok: true,
            courses,
            counts: {
                visible: visibleCount,
                hidden: hiddenCount,
            },
            pagination: { page: safePage, pageSize: safeSize, total, totalPages },
        }, { status: 200 });
    } catch (err) {
        console.error('courses API error:', err);
        return Response.json({ ok: false, error: 'Error interno del servidor' }, { status: 500 });
    }
};
