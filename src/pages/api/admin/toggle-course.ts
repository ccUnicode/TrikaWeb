export const prerender = false;

import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { validateAdminSession } from '../../../lib/adminAuth';

/**
 * Cambia la visibilidad de un curso (mostrar/ocultar en páginas públicas).
 * Los cursos ocultos no aparecen en listados ni búsquedas del frontend.
 */
export const PATCH: APIRoute = async ({ request, cookies }) => {
    try {
        const isValid = await validateAdminSession(cookies);
        if (!isValid) {
            return Response.json({ ok: false, error: 'Sesión inválida' }, { status: 401 });
        }

        let body;
        try {
            body = await request.json();
        } catch (err) {
            return Response.json({ ok: false, error: 'Cuerpo de petición inválido o vacío' }, { status: 400 });
        }

        const { course_id, is_hidden } = body || {};
        const id = Number(course_id);
        if (!Number.isSafeInteger(id) || id <= 0) {
            return Response.json({ ok: false, error: 'ID de curso inválido' }, { status: 400 });
        }

        if (typeof is_hidden !== 'boolean') {
            return Response.json({ ok: false, error: 'Valor de visibilidad inválido' }, { status: 400 });
        }

        const { data, error } = await supabaseAdmin.from('courses').update({ is_hidden }).eq('id', id).select();

        if (error) {
            console.error('Error toggling course visibility:', error);
            return Response.json({ ok: false, error: 'Error al actualizar visibilidad' }, { status: 500 });
        }

        if (!data || data.length === 0) {
            return Response.json({ ok: false, error: 'Curso no encontrado' }, { status: 404 });
        }

        return Response.json({ ok: true }, { status: 200 });
    } catch (err) {
        console.error('toggle-course API error:', err);
        return Response.json({ ok: false, error: 'Error interno del servidor' }, { status: 500 });
    }
};
