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
        const { teacher_id, is_hidden } = body;

        // Validate teacher_id
        const id = Number(teacher_id);
        if (!Number.isFinite(id) || id <= 0) {
            return new Response(
                JSON.stringify({ ok: false, error: 'ID de profesor inválido' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        // Validate is_hidden
        if (typeof is_hidden !== 'boolean') {
            return new Response(
                JSON.stringify({ ok: false, error: 'Valor de visibilidad inválido' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        // Update teacher visibility
        const { error } = await supabaseAdmin
            .from('teachers')
            .update({ is_hidden })
            .eq('id', id);

        if (error) {
            console.error('Error toggling teacher visibility:', error);
            return new Response(
                JSON.stringify({ ok: false, error: 'Error al actualizar visibilidad' }),
                { status: 500, headers: { 'Content-Type': 'application/json' } }
            );
        }

        return new Response(
            JSON.stringify({ ok: true }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
    } catch (err) {
        console.error('toggle-teacher API error:', err);
        return new Response(
            JSON.stringify({ ok: false, error: 'Error interno del servidor' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }
};
