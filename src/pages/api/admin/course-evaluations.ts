export const prerender = false;

import type { APIRoute } from "astro";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { validateAdminSession } from "../../../lib/adminAuth";

/**
 * GET /api/admin/course-evaluations?course_id=
 * Retorna los tipos de evaluación disponibles para un curso específico.
 * Busca en la tabla course_evaluations los evaluation_id asociados al course_id,
 * luego resuelve los nombres desde evaluation_type.
 */
export const GET: APIRoute = async ({ url, cookies }) => {
  try {
    const isValid = await validateAdminSession(cookies);

    if (!isValid) {
      return Response.json(
        {
          ok: false,
          error: "Sesión inválida",
        },
        { status: 401 },
      );
    }

    const courseIdParam = url.searchParams.get("course_id");
    const courseId = Number(courseIdParam);

    if (!Number.isInteger(courseId) || courseId <= 0) {
      return Response.json(
        {
          ok: false,
          error: "course_id inválido",
        },
        { status: 400 },
      );
    }

    const { data: course, error: courseError } = await supabaseAdmin
      .from("courses")
      .select("id, subsystem_id")
      .eq("id", courseId)
      .maybeSingle();

    if (courseError) {
      console.error("Error validating course:", courseError);

      return Response.json(
        {
          ok: false,
          error: "No se pudo validar el curso",
        },
        { status: 500 },
      );
    }

    if (!course) {
      return Response.json(
        {
          ok: false,
          error: "Curso no encontrado",
        },
        { status: 404 },
      );
    }

    if (course.subsystem_id === null) {
      return Response.json(
        {
          ok: false,
          error:
            "Este curso no tiene un subsistema de evaluaciones configurado.",
        },
        { status: 409 },
      );
    }

    const { data: courseEvaluations, error: courseEvaluationsError } =
      await supabaseAdmin
        .from("course_evaluations")
        .select("evaluation_id")
        .eq("course_id", courseId);

    if (courseEvaluationsError) {
      console.error(
        "Error fetching course_evaluations:",
        courseEvaluationsError,
      );

      return Response.json(
        {
          ok: false,
          error: "Error al obtener evaluaciones del curso",
        },
        { status: 500 },
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
        { status: 200 },
      );
    }

    const { data: evaluations, error: evaluationsError } = await supabaseAdmin
      .from("evaluation_type")
      .select(
        "evaluation_id, evaluation_name, evaluation_abr, evaluation_category",
      )
      .in("evaluation_id", evaluationIds)
      .order("evaluation_abr", { ascending: true });

    if (evaluationsError) {
      console.error("Error fetching evaluation_type:", evaluationsError);

      return Response.json(
        {
          ok: false,
          error: "Error al obtener detalle de evaluaciones",
        },
        { status: 500 },
      );
    }

    return Response.json(
      {
        ok: true,
        evaluations: evaluations ?? [],
      },
      { status: 200 },
    );
  } catch (err) {
    console.error("course-evaluations API error:", err);

    return Response.json(
      {
        ok: false,
        error: "Error interno del servidor",
      },
      { status: 500 },
    );
  }
};
