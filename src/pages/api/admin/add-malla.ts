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
    const { specialty_id, year, grid_rows, is_current } = body;

    if (!specialty_id || !year || !grid_rows) {
      return new Response(JSON.stringify({ error: 'Faltan campos obligatorios' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    // Si es actual, marcamos los demás como false
    if (is_current) {
      const { error: updateError } = await supabaseAdmin
        .from('study_plans')
        .update({ is_current: false })
        .eq('specialty_id', specialty_id);

      if (updateError) {
        console.error("Error actualizando mallas antiguas:", updateError);
        throw new Error("No se pudo actualizar el estado de las mallas anteriores");
      }
    }

    // Insertar nueva malla
    const { data: newPlan, error: insertError } = await supabaseAdmin
      .from('study_plans')
      .insert({
        specialty_id,
        year,
        grid_rows,
        is_current: is_current || false
      })
      .select()
      .single();

    if (insertError) throw insertError;

    return new Response(JSON.stringify({
      ok: true,
      plan: newPlan
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });

  } catch (err: any) {
    console.error("Error creando malla:", err);
    return new Response(JSON.stringify({ ok: false, error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};
