// src/pages/api/cursos/[cursoCode]/profesores.ts
// RF-30: Devuelve los profesores asociados a un curso dado su código.

export const prerender = false;

import type { APIRoute } from "astro";
import { supabaseClient } from "../../../../lib/supabase.client";

interface TeacherRow {
  id: number;
  full_name: string;
}

interface CourseTeacherJoin {
  teachers: TeacherRow | null;
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
    // 1. Buscar el curso por código
    const { data: course, error: courseError } = await supabaseClient
      .from("courses")
      .select("id")
      .ilike("code", cursoCode)
      .maybeSingle();

    if (courseError) {
      console.error("Error buscando curso:", courseError);
      return Response.json(
        { ok: false, error: "Error al buscar el curso" },
        { status: 500 }
      );
    }

    if (!course) {
      return Response.json(
        { ok: true, profesores: [] },
        { status: 200 }
      );
    }

    // 2. Obtener profesores asociados al curso via courses_teachers
    const { data: rows, error: joinError } = await supabaseClient
      .from("courses_teachers")
      .select("teachers:teacher_id ( id, full_name )")
      .eq("course_id", course.id);

    if (joinError) {
      console.error("Error obteniendo profesores del curso:", joinError);
      return Response.json(
        { ok: false, error: "Error al obtener profesores" },
        { status: 500 }
      );
    }

    const profesores = ((rows || []) as unknown as CourseTeacherJoin[])
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
