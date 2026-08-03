export const prerender = false;

import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { validateAdminSession } from '../../../lib/adminAuth';

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const isValid = await validateAdminSession(cookies);
    if (!isValid) {
      return new Response(JSON.stringify({ ok: false, error: 'Sesión inválida' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    }

    const body = await request.json();
    const { specialty_id, year, is_current } = body;

    if (!specialty_id || !year) {
      return new Response(JSON.stringify({ error: 'Faltan campos obligatorios' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    // Ejecutar ambas operaciones de manera atómica (desmarcar anteriores e insertar la nueva)
    const { data: newPlan, error: rpcError } = await supabaseAdmin.rpc('add_malla_transaction', {
      payload: {
        specialty_id,
        year,
        is_current: is_current || false
      }
    });

    if (rpcError) {
      console.error("Error en la transacción add_malla_transaction:", rpcError);
      throw rpcError;
    }

    return new Response(JSON.stringify({
      ok: true,
      plan: newPlan
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });

  } catch (err: any) {
    console.error("Error creando malla:", err);
    return new Response(JSON.stringify({ ok: false, error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};
