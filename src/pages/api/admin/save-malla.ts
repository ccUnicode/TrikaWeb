export const prerender = false;

import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';
import { validateAdminSession } from '../../../lib/adminAuth';

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const isValid = await validateAdminSession(cookies);
    if (!isValid) {
      return new Response(JSON.stringify({ ok: false, error: 'Sesión inválida' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    }

    const adminSession = cookies.get('admin_session')?.value;
    const supabase = createClient(
      import.meta.env.PUBLIC_SUPABASE_URL,
      import.meta.env.PUBLIC_SUPABASE_ANON_KEY,
      {
        global: {
          headers: {
            Authorization: `Bearer ${adminSession}`
          }
        }
      }
    );

    const body = await request.json();
    const { planId, placedCourses } = body;

    if (!planId) {
      return new Response(JSON.stringify({ error: 'Faltan campos obligatorios' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    // 1. Eliminar los cursos previos de este plan
    const { error: deleteError } = await supabase
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

      const { error: insertError } = await supabase
        .from('plan_courses')
        .insert(inserts);

      if (insertError) {
        console.error("Error al insertar cursos en plan_courses:", insertError);
        throw insertError;
      }

      // 3. Persistir Pre-requisitos
      for (const pc of placedCourses) {
        // Eliminar pre-requisitos previos
        const { error: delPrereqError } = await supabase
          .from('course_prerequisites')
          .delete()
          .eq('course_id', pc.course_id)
          .eq('plan_id', planId);

        if (delPrereqError) {
           console.error("Error al eliminar pre-requisitos:", delPrereqError);
           throw delPrereqError;
        }

        // Insertar nuevos pre-requisitos si existen
        if (pc.prerequisites && pc.prerequisites.length > 0) {
          const prereqInserts = pc.prerequisites.map((prereqId: number) => ({
            plan_id: planId,
            course_id: pc.course_id,
            prerequisite_id: prereqId
          }));

          const { error: insPrereqError } = await supabase
            .from('course_prerequisites')
            .insert(prereqInserts);

          if (insPrereqError) {
            console.error("Error al insertar pre-requisitos:", insPrereqError);
            throw insPrereqError;
          }
        }
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
