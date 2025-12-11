export const prerender = false;

import type { APIRoute } from "astro";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

export const POST: APIRoute = async ({ request }) => {
    let body: any;
    try {
        body = await request.json();
    } catch {
        return new Response(JSON.stringify({ ok: false, error: "JSON inválido" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
        });
    }

    const adminPass = String(body?.admin_pass ?? "");

    if (!adminPass) {
        return new Response(
            JSON.stringify({ ok: false, error: "Falta admin_pass" }),
            { status: 400, headers: { "Content-Type": "application/json" } }
        );
    }

    if (adminPass !== (import.meta.env.ADMIN_PASS as string)) {
        return new Response(
            JSON.stringify({ ok: false, error: "Clave de administrador incorrecta" }),
            { status: 401, headers: { "Content-Type": "application/json" } }
        );
    }

    // Fetch all hidden comments with teacher info
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
