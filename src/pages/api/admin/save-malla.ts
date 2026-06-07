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
    const { planId, placedCourses } = body;

    if (!planId) {
      return new Response(JSON.stringify({ error: 'Faltan campos obligatorios' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    // 1. Eliminar los cursos previos de este plan
    const { error: deleteError } = await supabaseAdmin
      .from('plan_courses')
      .delete()
      .eq('plan_id', planId);

    if (deleteError) {
      console.error("Error al eliminar cursos del plan anterior:", deleteError);
      throw deleteError;
    }

    // 2. Insertar los nuevos cursos si existen
    if (placedCourses && placedCourses.length > 0) {
      const inserts = placedCourses.map((pc: any) => ({
        plan_id: planId,
        course_id: pc.course_id,
        cycle: pc.cycle,
        row_index: pc.row_index
      }));

      const { error: insertError } = await supabaseAdmin
        .from('plan_courses')
        .insert(inserts);

      if (insertError) {
        console.error("Error al insertar cursos en plan_courses:", insertError);
        throw insertError;
      }
    }

    return new Response(JSON.stringify({
      ok: true
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });

  } catch (err: any) {
    console.error("Error guardando malla:", err);
    return new Response(JSON.stringify({ ok: false, error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};
