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

        const body = await request.json();
        const { course_id } = body;

        const id = Number(course_id);
        if (!Number.isFinite(id) || id <= 0) {
            return new Response(JSON.stringify({ ok: false, error: 'ID de curso inválido' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const { error } = await supabaseAdmin.from('courses').delete().eq('id', id);

        if (error) {
            console.error('Error deleting course:', error);
            return new Response(JSON.stringify({ ok: false, error: 'Error al eliminar el curso' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const { count: visibleCount } = await supabaseAdmin.from('courses').select('id', { count: 'exact', head: true }).eq('is_hidden', false);
        const { count: hiddenCount } = await supabaseAdmin.from('courses').select('id', { count: 'exact', head: true }).eq('is_hidden', true);

        return new Response(JSON.stringify({ 
            ok: true, 
            counts: { visible: visibleCount ?? 0, hidden: hiddenCount ?? 0 } 
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (err) {
        console.error('delete-course API error:', err);
        return new Response(JSON.stringify({ ok: false, error: 'Error interno del servidor' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
};
