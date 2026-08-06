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
        const { planId } = body;

        if (!planId) {
            return new Response(
                JSON.stringify({ ok: false, error: 'ID de malla requerido' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        // Obtener el estado actual de la malla
        const { data: plan, error: fetchError } = await supabaseAdmin
            .from('study_plans')
            .select('id, is_published')
            .eq('id', planId)
            .single();

        if (fetchError || !plan) {
            console.error('Error obteniendo malla:', fetchError);
            return new Response(
                JSON.stringify({ ok: false, error: 'Malla no encontrada' }),
                { status: 404, headers: { 'Content-Type': 'application/json' } }
            );
        }

        // Toggle del estado
        const newState = !plan.is_published;

        const { error: updateError } = await supabaseAdmin
            .from('study_plans')
            .update({ is_published: newState })
            .eq('id', planId);

        if (updateError) {
            console.error('Error actualizando estado de malla:', updateError);
            return new Response(
                JSON.stringify({ ok: false, error: 'Error al actualizar estado' }),
                { status: 500, headers: { 'Content-Type': 'application/json' } }
            );
        }

        return new Response(
            JSON.stringify({ ok: true, is_published: newState }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
    } catch (err) {
        console.error('toggle-malla API error:', err);
        return new Response(
            JSON.stringify({ ok: false, error: 'Error interno del servidor' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }
};
