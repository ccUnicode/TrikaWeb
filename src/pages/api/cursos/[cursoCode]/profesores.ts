// src/pages/api/cursos/[cursoCode]/profesores.ts
// RF-30: Devuelve los profesores asociados a un curso dado su código.

export const prerender = false;

import type { APIRoute } from "astro";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

export const GET: APIRoute = async ({ params }) => {
  const cursoCode = (params.cursoCode ?? "").trim().toUpperCase();

  if (!cursoCode) {
    return new Response(
      JSON.stringify({ ok: false, error: "Código de curso requerido" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    // 1. Buscar el curso por código
    const { data: course, error: courseError } = await supabaseAdmin
      .from("courses")
      .select("id")
      .ilike("code", cursoCode)
      .maybeSingle();

    if (courseError) {
      console.error("Error buscando curso:", courseError);
      return new Response(
        JSON.stringify({ ok: false, error: "Error al buscar el curso" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!course) {
      return new Response(
        JSON.stringify({ ok: true, profesores: [] }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // 2. Obtener profesores asociados al curso via courses_teachers
    const { data: rows, error: joinError } = await supabaseAdmin
      .from("courses_teachers")
      .select("teachers:teacher_id ( id, full_name )")
      .eq("course_id", course.id);

    if (joinError) {
      console.error("Error obteniendo profesores del curso:", joinError);
      return new Response(
        JSON.stringify({ ok: false, error: "Error al obtener profesores" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const profesores = (rows || [])
      .map((row: any) => row.teachers)
      .filter(Boolean)
      .map((t: any) => ({ id: t.id, full_name: t.full_name }))
      .sort((a: any, b: any) => a.full_name.localeCompare(b.full_name));

    return new Response(
      JSON.stringify({ ok: true, profesores }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error inesperado en /api/cursos/[cursoCode]/profesores:", err);
    return new Response(
      JSON.stringify({ ok: false, error: "Error interno del servidor" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};
