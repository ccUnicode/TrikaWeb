export const prerender = false;

import type { APIRoute } from "astro";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

export const GET: APIRoute = async ({ params }) => {
  try {
    const cursoCode = params.cursoCode?.trim().toUpperCase();

    if (!cursoCode) {
      return new Response(
        JSON.stringify({
          ok: false,
          profesores: [],
          error: "Código inválido",
        }),
        { status: 400 }
      );
    }

    const { data: course, error: courseError } = await supabaseAdmin
      .from("courses")
      .select("id")
      .eq("code", cursoCode)
      .single();

    if (courseError || !course) {
      return new Response(
        JSON.stringify({
          ok: false,
          profesores: [],
          error: "Curso no encontrado",
        }),
        { status: 404 }
      );
    }

    const { data: teachers, error: teachersError } = await supabaseAdmin
      .from("courses_teachers")
      .select(`
        teachers (
          id,
          full_name
        )
      `)
      .eq("course_id", course.id);

    if (teachersError) {
      throw teachersError;
    }

    const profesoresFormateados =
      teachers?.map((t) => t.teachers).filter(Boolean) || [];

    return new Response(
      JSON.stringify({
        ok: true,
        profesores: profesoresFormateados,
      }),
      {
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error en profesores.ts:", error);

    return new Response(
      JSON.stringify({
        ok: false,
        profesores: [],
        error: "Error interno",
      }),
      { status: 500 }
    );
  }
};