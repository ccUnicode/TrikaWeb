export const prerender = false;

import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { validateAdminSession } from '../../../lib/adminAuth';

/**
 * Persiste la estructura visual de una malla curricular en la base de datos.
 * 
 * Este endpoint es el núcleo de persistencia del Constructor de Mallas. Recibe el 
 * arreglo de cursos posicionados y valida su estructura (payload). Luego, delega todo el patrón 
 * de reemplazo ("eliminar e insertar") a un Procedimiento Almacenado (RPC) en Supabase, 
 * garantizando integridad atómica y transaccional a nivel de base de datos.
 * 
 * @param {Request} request - El objeto request HTTP que contiene `planId` y `placedCourses`.
 * @returns {Response} Un JSON confirmando el éxito o el error detallado.
 */
export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const isValid = await validateAdminSession(cookies);
    if (!isValid) {
      return new Response(JSON.stringify({ ok: false, error: 'Sesión inválida' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    }

    // Se validó correctamente al admin arriba; podemos usar supabaseAdmin con service_role

    const body = await request.json();
    const { planId, placedCourses } = body;

    if (!planId || !Array.isArray(placedCourses)) {
      return new Response(JSON.stringify({ error: 'Faltan campos obligatorios o formato inválido' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    // Validar el payload antes de cualquier operación
    const isValidPayload = placedCourses.every((pc: any) =>
      typeof pc.course_id === 'number' &&
      typeof pc.cycle === 'number' &&
      typeof pc.row_index === 'number' &&
      (pc.prerequisites === undefined || Array.isArray(pc.prerequisites))
    );

    if (!isValidPayload) {
      return new Response(JSON.stringify({ error: 'Estructura de payload inválida' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    // Limpiar y revalidar los prerrequisitos
    // 1. El curso prerrequisito debe seguir existiendo en la malla
    // 2. El curso prerrequisito debe estar en un ciclo estrictamente menor
    const courseCycleMap = new Map<number, number>();
    placedCourses.forEach((pc: any) => courseCycleMap.set(pc.course_id, pc.cycle));

    const sanitizedCourses = placedCourses.map((pc: any) => {
      const validPrerequisites = (pc.prerequisites || []).filter((prereqId: number) => {
        const prereqCycle = courseCycleMap.get(prereqId);
        return prereqCycle !== undefined && prereqCycle < pc.cycle;
      });

      return {
        ...pc,
        prerequisites: validPrerequisites
      };
    });

    // Ejecutar todo el reemplazo en una única transacción mediante RPC usando privilegios de administrador (service_role)
    const { error: rpcError } = await supabaseAdmin.rpc('save_malla_transaction', {
      p_plan_id: planId,
      p_placed_courses: sanitizedCourses
    });

    if (rpcError) {
      console.error("Error en la transacción save_malla_transaction:", rpcError);
      throw rpcError;
    }

    return new Response(JSON.stringify({
      ok: true
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });

  } catch (err: any) {
    console.error("Error guardando malla:", err);
    return new Response(JSON.stringify({ ok: false, error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};
