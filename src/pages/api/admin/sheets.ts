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

        const { page = 1, pageSize = 20, course = '', q = '' } = body;

        const safePage = Math.max(1, Math.floor(Number(page) || 1));
        const safeSize = Math.min(100, Math.max(1, Math.floor(Number(pageSize) || 20)));
        const from = (safePage - 1) * safeSize;
        const to = from + safeSize - 1;

        let courseIds: number[] | null = null;

        // 1. Resolve Course IDs if filter provided
        if (String(course || '').trim()) {
            const coursePattern = `%${String(course).trim()}%`;
            const { data: courseRows, error: courseError } = await supabaseAdmin
                .from('courses')
                .select('id')
                .or(`code.ilike.${coursePattern},name.ilike.${coursePattern}`);

            if (courseError) {
                console.error('Error fetching courses for sheet filter:', courseError);
                return new Response(JSON.stringify({ ok: false, error: 'Error al filtrar por curso' }), {
                    status: 500,
                    headers: { 'Content-Type': 'application/json' },
                });
            }

            courseIds = (courseRows || []).map((c: any) => Number(c.id));

            // If user searched for a course but none found, return empty early
            if (courseIds.length === 0) {
                return new Response(
                    JSON.stringify({
                        ok: true,
                        sheets: [],
                        counts: { visible: 0, hidden: 0 },
                        pagination: { page: safePage, pageSize: safeSize, total: 0, totalPages: 0 },
                    }),
                    { status: 200, headers: { 'Content-Type': 'application/json' } }
                );
            }
        }

        // 2. Build Base Query for Filtering
        const buildBaseQuery = () => {
            let query = supabaseAdmin.from('sheets').select('*');
            if (courseIds) {
                query = query.in('course_id', courseIds);
            }
            if (String(q || '').trim()) {
                const pattern = `%${String(q).trim()}%`;
                query = query.or(`exam_type.ilike.${pattern},cycle.ilike.${pattern},teacher_hint.ilike.${pattern}`);
            }
            return query;
        };

        // 3. Get TOTAL counts for visible and hidden (filtered)
        const [visibleTotalRes, hiddenTotalRes] = await Promise.all([
            buildBaseQuery().eq('is_hidden', false).select('*', { count: 'exact', head: true }),
            buildBaseQuery().eq('is_hidden', true).select('*', { count: 'exact', head: true })
        ]);

        const visibleTotal = visibleTotalRes.count ?? 0;
        const hiddenTotal = hiddenTotalRes.count ?? 0;
        const total = visibleTotal + hiddenTotal;

        // 4. Fetch the actual page of data
        let mainQuery = supabaseAdmin
            .from('sheets')
            .select('id, exam_type, cycle, teacher_hint, avg_difficulty, rating_count, view_count, solution_kind, thumb_storage_path, is_hidden, courses:course_id (code,name)')
            .order('cycle', { ascending: false })
            .order('exam_type', { ascending: true })
            .range(from, to);

        if (courseIds) {
            mainQuery = mainQuery.in('course_id', courseIds);
        }
        if (String(q || '').trim()) {
            const pattern = `%${String(q).trim()}%`;
            mainQuery = mainQuery.or(`exam_type.ilike.${pattern},cycle.ilike.${pattern},teacher_hint.ilike.${pattern}`);
        }

        const { data, error } = await mainQuery;

        if (error) {
            console.error('Error fetching sheets:', error);
            return new Response(JSON.stringify({ ok: false, error: 'Error al obtener planchas' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const sheets = (data || []).map((s: any) => {
            const courseData = Array.isArray(s.courses) ? s.courses[0] : s.courses;
            return {
                id: s.id,
                exam_type: s.exam_type,
                cycle: s.cycle,
                teacher_hint: s.teacher_hint,
                avg_difficulty: s.avg_difficulty,
                rating_count: s.rating_count ?? 0,
                view_count: s.view_count ?? 0,
                solution_kind: s.solution_kind ?? null,
                thumb_storage_path: s.thumb_storage_path ?? null,
                is_hidden: s.is_hidden ?? false,
                course_code: courseData?.code ?? null,
                course_name: courseData?.name ?? null,
            };
        });

        const totalPages = total > 0 ? Math.ceil(total / safeSize) : 0;

        return new Response(
            JSON.stringify({
                ok: true,
                sheets,
                counts: { visible: visibleTotal, hidden: hiddenTotal },
                pagination: { page: safePage, pageSize: safeSize, total, totalPages },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
    } catch (err) {
        console.error('admin sheets API error:', err);
        return new Response(JSON.stringify({ ok: false, error: 'Error interno del servidor' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
};
