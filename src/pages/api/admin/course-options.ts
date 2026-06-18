export const prerender = false;

import type { APIRoute } from "astro";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { validateAdminSession } from "../../../lib/adminAuth";

export const GET: APIRoute = async ({ cookies }) => {
  try {
    const isValid = await validateAdminSession(cookies);
    if (!isValid) {
      return Response.json({ ok: false, error: "Sesión inválida" }, { status: 401 });
    }

    const { data, error } = await supabaseAdmin
      .from("courses")
      .select("id, code, name")
      .eq("is_hidden", false)
      .order("code", { ascending: true });

    if (error) {
      console.error("Error fetching course options:", error);
      return Response.json({ ok: false, error: "Error al obtener cursos" }, { status: 500 });
    }

    return Response.json({ ok: true, courses: data ?? [] }, { status: 200 });
  } catch (err) {
    console.error("course-options API error:", err);
    return Response.json({ ok: false, error: "Error interno del servidor" }, { status: 500 });
  }
};