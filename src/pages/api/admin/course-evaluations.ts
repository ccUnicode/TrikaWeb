export const prerender = false;

import type { APIRoute } from "astro";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { validateAdminSession } from "../../../lib/adminAuth";

export const GET: APIRoute = async ({ url, cookies }) => {
  try {
    const isValid = await validateAdminSession(cookies);

    if (!isValid) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "Sesión inválida",
        }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const courseIdParam = url.searchParams.get("course_id");
    const courseId = Number(courseIdParam);

    if (!Number.isInteger(courseId) || courseId <= 0) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "course_id inválido",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const { data: courseEvaluations, error: courseEvaluationsError } = await supabaseAdmin
      .from("course_evaluations")
      .select("evaluation_id")
      .eq("course_id", courseId);

    if (courseEvaluationsError) {
      console.error("Error fetching course_evaluations:", courseEvaluationsError);

      return new Response(
        JSON.stringify({
          ok: false,
          error: "Error al obtener evaluaciones del curso",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const evaluationIds = (courseEvaluations ?? [])
      .map((row) => row.evaluation_id)
      .filter((id): id is number => Number.isInteger(id));

    if (evaluationIds.length === 0) {
      return new Response(
        JSON.stringify({
          ok: true,
          evaluations: [],
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const { data: evaluations, error: evaluationsError } = await supabaseAdmin
      .from("evaluation_type")
      .select("evaluation_id, evaluation_name, evaluation_abr, evaluation_category")
      .in("evaluation_id", evaluationIds)
      .order("evaluation_abr", { ascending: true });

    if (evaluationsError) {
      console.error("Error fetching evaluation_type:", evaluationsError);

      return new Response(
        JSON.stringify({
          ok: false,
          error: "Error al obtener detalle de evaluaciones",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({
        ok: true,
        evaluations: evaluations ?? [],
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("course-evaluations API error:", err);

    return new Response(
      JSON.stringify({
        ok: false,
        error: err instanceof Error ? err.message : "Error interno del servidor",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
};