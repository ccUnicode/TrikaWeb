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
        const { id, specialty_id, year, is_current } = body;

        if (!id || !specialty_id || !year) {
            return new Response(
                JSON.stringify({ ok: false, error: 'Faltan campos obligatorios' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        // Ejecutar la edición de forma atómica mediante RPC
        const { error: rpcError } = await supabaseAdmin.rpc('edit_malla_transaction', {
            payload: {
                id,
                specialty_id,
                year,
                is_current
            }
        });

        if (rpcError) {
            console.error('Error al actualizar malla en transacción:', rpcError);
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
