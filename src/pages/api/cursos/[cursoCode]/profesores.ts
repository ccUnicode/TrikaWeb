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

    // 🔥 1. Buscar curso en tabla REAL
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

    // 🔥 2. Relación correcta courses_teachers → teachers
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

    // 🔥 3. Formateo
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