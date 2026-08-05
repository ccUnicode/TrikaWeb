export const prerender = false;

import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { validateAdminSession } from '../../../lib/adminAuth';

export const POST: APIRoute = async ({ request, cookies }) => {
    try {
        const isValid = await validateAdminSession(cookies);
        if (!isValid) {
            return new Response(
                JSON.stringify({ ok: false, error: 'Sesión inválida' }),
                { status: 401, headers: { 'Content-Type': 'application/json' } }
            );
        }

        const body = await request.json();
        const { id } = body;

        if (!id) {
            return new Response(
                JSON.stringify({ ok: false, error: 'ID de malla requerido' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        const { error: deleteError } = await supabaseAdmin
            .from('study_plans')
            .delete()
            .eq('id', id);

        if (deleteError) {
            console.error('Error al eliminar malla:', deleteError);
            return new Response(
                JSON.stringify({ ok: false, error: 'Error al eliminar en base de datos' }),
                { status: 500, headers: { 'Content-Type': 'application/json' } }
            );
        }

        return new Response(
            JSON.stringify({ ok: true }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
    } catch (err) {
        console.error('delete-malla API error:', err);
        return new Response(
            JSON.stringify({ ok: false, error: 'Error interno del servidor' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }
};
