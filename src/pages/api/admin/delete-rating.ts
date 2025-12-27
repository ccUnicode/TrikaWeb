export const prerender = false;

import type { APIRoute } from "astro";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { validateAdminSession } from "../../../lib/adminAuth";

export const POST: APIRoute = async ({ request, cookies }) => {
    // Validate session from cookie
    const isValid = await validateAdminSession(cookies);
    if (!isValid) {
        return new Response(
            JSON.stringify({ ok: false, error: "Sesión inválida" }),
            { status: 401, headers: { "Content-Type": "application/json" } }
        );
    }

    let body: any;
    try {
        body = await request.json();
    } catch {
        return new Response(JSON.stringify({ ok: false, error: "JSON inválido" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
        });
    }

    const ratingId = Number(body?.rating_id ?? 0);

    if (!ratingId) {
        return new Response(
            JSON.stringify({ ok: false, error: "Falta rating_id" }),
            { status: 400, headers: { "Content-Type": "application/json" } }
        );
    }

    // Eliminar la calificación completamente (no solo ocultar)
    const { error } = await supabaseAdmin
        .from("teacher_ratings")
        .delete()
        .eq("id", ratingId);

    if (error) {
        console.error("Error delete-rating:", error);
        return new Response(
            JSON.stringify({ ok: false, error: "No se pudo eliminar la calificación" }),
            { status: 500, headers: { "Content-Type": "application/json" } }
        );
    }

    return new Response(
        JSON.stringify({
            ok: true,
            rating_id: ratingId,
            deleted: true,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
    );
};
