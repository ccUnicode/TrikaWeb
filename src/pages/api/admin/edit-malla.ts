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
        const { id, specialty_id, year, grid_rows, is_current } = body;

        if (!id || !specialty_id || !year || !grid_rows) {
            return new Response(
                JSON.stringify({ ok: false, error: 'Faltan campos obligatorios' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        // Si se marca como vigente, primero quitamos el vigente a las demás mallas de la misma especialidad
        if (is_current) {
            const { error: resetError } = await supabaseAdmin
                .from('study_plans')
                .update({ is_current: false })
                .eq('specialty_id', specialty_id)
                .neq('id', id);

            if (resetError) {
                console.error("Error real al actualizar mallas previas en edit:", resetError);
                // No detenemos el flujo, es posible que no haya mallas previas
            }
        }

        // Actualizar la malla
        const { error: updateError } = await supabaseAdmin
            .from('study_plans')
            .update({ year, grid_rows, is_current })
            .eq('id', id);

        if (updateError) {
            console.error('Error al actualizar malla:', updateError);
            return new Response(
                JSON.stringify({ ok: false, error: 'Error al actualizar en base de datos' }),
                { status: 500, headers: { 'Content-Type': 'application/json' } }
            );
        }

        return new Response(
            JSON.stringify({ ok: true }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
    } catch (err) {
        console.error('edit-malla API error:', err);
        return new Response(
            JSON.stringify({ ok: false, error: 'Error interno del servidor' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }
};
