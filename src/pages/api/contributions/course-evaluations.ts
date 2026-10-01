export const prerender = false;

import type { APIRoute } from "astro";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { getUserSession } from "../../../lib/auth";

/**
 * GET /api/contributions/course-evaluations?course_id=
 * Retorna los tipos de evaluación disponibles para un curso específico
 * para el formulario de donaciones/aportes de estudiantes.
 */
export const GET: APIRoute = async ({ url, cookies }) => {
  try {
    const { user } = await getUserSession(cookies);
    if (!user) {
      return Response.json(
        { ok: false, error: "No autorizado" },
        { status: 401 }
      );
    }

    const courseIdParam = url.searchParams.get("course_id");
    const courseId = Number(courseIdParam);

    if (!Number.isInteger(courseId) || courseId <= 0) {
      return Response.json(
        { ok: false, error: "course_id inválido" },
        { status: 400 }
      );
    }

    // 1. Obtener los evaluation_id asociados al curso en course_evaluations
    const { data: courseEvaluations, error: courseEvaluationsError } = await supabaseAdmin
      .from("course_evaluations")
      .select("evaluation_id")
      .eq("course_id", courseId);

    if (courseEvaluationsError) {
      console.error("Error fetching course_evaluations:", courseEvaluationsError);
      return Response.json(
        { ok: false, error: "Error al obtener evaluaciones del curso" },
        { status: 500 }
      );
    }

    const evaluationIds = (courseEvaluations ?? [])
      .map((row) => row.evaluation_id)
      .filter((id): id is number => Number.isInteger(id));

    if (evaluationIds.length === 0) {
      return Response.json(
        {
          ok: true,
          evaluations: [],
        },
        { status: 200 }
      );
    }

    // 2. Obtener nombres y abreviaciones desde evaluation_type
    const { data: evaluations, error: evaluationsError } = await supabaseAdmin
      .from("evaluation_type")
      .select("evaluation_id, evaluation_name, evaluation_abr, evaluation_category")
      .in("evaluation_id", evaluationIds)
      .order("evaluation_abr", { ascending: true });

    if (evaluationsError) {
      console.error("Error fetching evaluation_type:", evaluationsError);
      return Response.json(
        { ok: false, error: "Error al obtener detalle de evaluaciones" },
        { status: 500 }
      );
    }

    return Response.json(
      {
        ok: true,
        evaluations: evaluations ?? [],
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("contributions/course-evaluations error:", err);
    return Response.json(
      { ok: false, error: "Error interno del servidor" },
      { status: 500 }
    );
  }
};
