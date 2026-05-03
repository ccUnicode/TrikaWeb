export const prerender = false;

import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { validateAdminSession } from '../../../lib/adminAuth';

/**
 * Relaciones con teachers (ver supabase/schema.sql):
 * - courses_teachers.teacher_id → ON DELETE CASCADE
 * - teacher_ratings.teacher_id → ON DELETE CASCADE
 *
 * Aun así borramos hijos antes del docente para que el endpoint no dependa
 * solo de que la BD de producción tenga esos cascades aplicados.
 */
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
        const { teacher_id } = body;

        const id = Number(teacher_id);
        if (!Number.isFinite(id) || id <= 0) {
            return new Response(JSON.stringify({ ok: false, error: 'ID de docente inválido' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const { error: ratingsError } = await supabaseAdmin.from('teacher_ratings').delete().eq('teacher_id', id);
        if (ratingsError) {
            console.error('Error deleting teacher_ratings:', ratingsError);
            return new Response(JSON.stringify({ ok: false, error: 'Error al eliminar calificaciones del docente' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const { error: linksError } = await supabaseAdmin.from('courses_teachers').delete().eq('teacher_id', id);
        if (linksError) {
            console.error('Error deleting courses_teachers:', linksError);
            return new Response(JSON.stringify({ ok: false, error: 'Error al eliminar asociaciones curso-docente' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const { error } = await supabaseAdmin.from('teachers').delete().eq('id', id);

        if (error) {
            console.error('Error deleting teacher:', error);
            return new Response(JSON.stringify({ ok: false, error: 'Error al eliminar el docente' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        return new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (err) {
        console.error('delete-teacher API error:', err);
        return new Response(JSON.stringify({ ok: false, error: 'Error interno del servidor' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
};
