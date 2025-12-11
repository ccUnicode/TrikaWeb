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
    const ratingId = Number(body?.rating_id ?? 0);

    if (!adminPass || !ratingId) {
        return new Response(
            JSON.stringify({ ok: false, error: "Falta admin_pass o rating_id" }),
            { status: 400, headers: { "Content-Type": "application/json" } }
        );
    }

    if (adminPass !== (import.meta.env.ADMIN_PASS as string)) {
        return new Response(
            JSON.stringify({ ok: false, error: "Clave de administrador incorrecta" }),
            { status: 401, headers: { "Content-Type": "application/json" } }
        );
    }

    const { data, error } = await supabaseAdmin
        .from("teacher_ratings")
        .update({ is_hidden: false })
        .eq("id", ratingId)
        .select("id, comment")
        .single();

    if (error) {
        const status = error.code === "PGRST116" ? 404 : 500;
        const message =
            status === 404
                ? "No se encontró el comentario"
                : "No se pudo aprobar el comentario";
        if (status === 500) {
            console.error("Error approve-comment:", error);
        }
        return new Response(
            JSON.stringify({ ok: false, error: message }),
            { status, headers: { "Content-Type": "application/json" } }
        );
    }

    return new Response(
        JSON.stringify({
            ok: true,
            rating_id: ratingId,
            approved: true,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
    );
};
