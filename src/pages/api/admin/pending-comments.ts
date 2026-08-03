export const prerender = false;

import type { APIRoute } from "astro";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { validateAdminSession } from "../../../lib/adminAuth";

/**
 * Obtiene los comentarios pendientes de moderación (is_hidden = true).
 * Incluye datos del profesor asociado para facilitar la revisión.
 * Ordenados del más reciente al más antiguo.
 */
export const POST: APIRoute = async ({ cookies }) => {
    const isValid = await validateAdminSession(cookies);
    if (!isValid) {
        return new Response(
            JSON.stringify({ ok: false, error: "Sesión inválida" }),
            { status: 401, headers: { "Content-Type": "application/json" } }
        );
    }

    // Obtiene comentarios ocultos con info del profesor
    const { data, error } = await supabaseAdmin
        .from("teacher_ratings")
        .select(`
      id,
      grading,
      comment,
      created_at,
      teacher_id,
      is_anonymous,
      user_name,
      user_email,
      teachers (
        id,
        full_name
      )
    `)
        .eq("is_hidden", true)
        .order("created_at", { ascending: false });

    if (error) {
        console.error("Error fetching pending comments:", error);
        return new Response(
            JSON.stringify({ ok: false, error: "Error al obtener comentarios" }),
            { status: 500, headers: { "Content-Type": "application/json" } }
        );
    }

    return new Response(
        JSON.stringify({
            ok: true,
            comments: data ?? [],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
    );
};
