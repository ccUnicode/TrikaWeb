export const prerender = false;

import type { APIRoute } from "astro";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { validateAdminSession } from "../../../lib/adminAuth";

const VARIABLE_EVALUATION_CATEGORIES = [
  "PRACTICA",
  "LABORATORIO",
  "TRABAJO",
];

export const GET: APIRoute = async ({ url, cookies }) => {
  try {
    const isValid = await validateAdminSession(cookies);

    if (!isValid) {
      return Response.json(
        {
          ok: false,
          error: "Sesión inválida",
        },
        {
          status: 401,
        },
      );
    }

    const courseId = Number(
      url.searchParams.get("course_id"),
    );

    if (!Number.isInteger(courseId) || courseId <= 0) {
      return Response.json(
        {
          ok: false,
          error: "Curso inválido",
        },
        {
          status: 400,
        },
      );
    }

    const { data: course, error: courseError } =
      await supabaseAdmin
        .from("courses")
        .select(`
          id,
          code,
          name,
          summary,
          credits,
          system_id,
          subsystem_id,
          status,
          is_hidden
        `)
        .eq("id", courseId)
        .maybeSingle();

    if (courseError) {
      console.error(
        "Error fetching course details:",
        courseError,
      );

      return Response.json(
        {
          ok: false,
          error: "No se pudo obtener el curso",
        },
        {
          status: 500,
        },
      );
    }

    if (!course) {
      return Response.json(
        {
          ok: false,
          error: "Curso no encontrado",
        },
        {
          status: 404,
        },
      );
    }

    const {
      data: courseEvaluationRows,
      error: courseEvaluationsError,
    } = await supabaseAdmin
      .from("course_evaluations")
      .select("evaluation_id")
      .eq("course_id", courseId);

    if (courseEvaluationsError) {
      console.error(
        "Error fetching course evaluations:",
        courseEvaluationsError,
      );

      return Response.json(
        {
          ok: false,
          error:
            "No se pudieron obtener las evaluaciones del curso",
        },
        {
          status: 500,
        },
      );
    }

    const evaluationIds: number[] = [
      ...new Set<number>(
        (courseEvaluationRows || [])
          .map((row: any) =>
            Number(row.evaluation_id),
          )
          .filter(
            (id: number) =>
              Number.isInteger(id) && id > 0,
          ),
      ),
    ];

    let selectedEvaluations: number[] = [];

    if (evaluationIds.length > 0) {
      const {
        data: evaluationRows,
        error: evaluationsError,
      } = await supabaseAdmin
        .from("evaluation_type")
        .select(
          "evaluation_id, evaluation_category",
        )
        .in("evaluation_id", evaluationIds);

      if (evaluationsError) {
        console.error(
          "Error fetching evaluation types:",
          evaluationsError,
        );

        return Response.json(
          {
            ok: false,
            error:
              "No se pudo obtener la configuración de evaluaciones",
          },
          {
            status: 500,
          },
        );
      }

      selectedEvaluations = (
        evaluationRows || []
      )
        .filter((evaluation: any) => {
          const category = String(
            evaluation.evaluation_category || "",
          )
            .trim()
            .toUpperCase();

          return VARIABLE_EVALUATION_CATEGORIES.includes(
            category,
          );
        })
        .map((evaluation: any) =>
          Number(evaluation.evaluation_id),
        )
        .filter(
          (id: number) =>
            Number.isInteger(id) && id > 0,
        );
    }

    return Response.json(
      {
        ok: true,
        course: {
          id: course.id,
          code: course.code,
          name: course.name,
          summary: course.summary ?? "",
          credits: course.credits ?? 0,
          system_id: course.system_id,
          subsystem_id: course.subsystem_id,
          status: course.status,
          is_hidden: course.is_hidden ?? false,
          selected_evaluations:
            selectedEvaluations,
        },
      },
      {
        status: 200,
      },
    );
  } catch (err) {
    console.error(
      "course-details API error:",
      err,
    );

    return Response.json(
      {
        ok: false,
        error: "Error interno del servidor",
      },
      {
        status: 500,
      },
    );
  }
};