// src/pages/api/cursos/[cursoCode]/profesores.ts
// RF-30: Devuelve los profesores asociados a un curso dado su código.

export const prerender = false;

import type { APIRoute } from "astro";
import { supabaseClient } from "../../../../lib/supabase.client";

interface TeacherRow {
  id: number;
  full_name: string;
}

interface CourseWithTeachers {
  id: number;
  courses_teachers: { teachers: TeacherRow | null }[];
}

export const GET: APIRoute = async ({ params }) => {
  const cursoCode = (params.cursoCode ?? "").trim().toUpperCase();

  if (!cursoCode) {
    return Response.json(
      { ok: false, error: "Código de curso requerido" },
      { status: 400 }
    );
  }

  try {
    // Consulta única con JOIN implícito: courses → courses_teachers → teachers
    const { data: course, error: queryError } = await supabaseClient
      .from("courses")
      .select("id, courses_teachers ( teachers:teacher_id ( id, full_name ) )")
      .ilike("code", cursoCode)
      .maybeSingle<CourseWithTeachers>();

    if (queryError) {
      console.error("Error buscando curso y profesores:", queryError);
      return Response.json(
        { ok: false, error: "Error al buscar el curso" },
        { status: 500 }
      );
    }

    if (!course) {
      return Response.json(
        { ok: false, error: "Curso no encontrado" },
        { status: 404 }
      );
    }

    const profesores = (course.courses_teachers ?? [])
      .map((row) => row.teachers)
      .filter((t): t is TeacherRow => t !== null && t !== undefined)
      .map((t) => ({ id: t.id, full_name: t.full_name }))
      .sort((a, b) => a.full_name.localeCompare(b.full_name));

    return Response.json(
      { ok: true, profesores },
      { status: 200 }
    );
  } catch (err) {
    console.error("Error inesperado en /api/cursos/[cursoCode]/profesores:", err);
    return Response.json(
      { ok: false, error: "Error interno del servidor" },
      { status: 500 }
    );
  }
};
