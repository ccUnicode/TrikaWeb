export const prerender = false;

import type { APIRoute } from "astro";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { validateAdminSession } from "../../../lib/adminAuth";

/**
 * POST /api/admin/pending-comments
 * Retorna todos los comentarios ocultos (is_hidden=true) en teacher_ratings
 * que requieren aprobación del moderador.
 */
export const POST: APIRoute = async ({ cookies }) => {
    const isValid = await validateAdminSession(cookies);
    if (!isValid) {
        return new Response(
            JSON.stringify({ ok: false, error: "Sesión inválida" }),
            { status: 401, headers: { "Content-Type": "application/json" } }
        );
    }

    const { data, error } = await supabaseAdmin
        .from("teacher_ratings")
        .select(`
      id,
      grading,
      comment,
      created_at,
      teacher_id,
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
