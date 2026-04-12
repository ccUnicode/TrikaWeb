export const prerender = false;

import type { APIRoute } from "astro";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { validateAdminSession } from "../../../lib/adminAuth";

const ALLOWED_TABLES = ["teacher_ratings", "sheet_feedback"] as const;
type AllowedTable = typeof ALLOWED_TABLES[number];

export const POST: APIRoute = async ({ request, cookies }) => {
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
    const table = (body?.table ?? "teacher_ratings") as string;

    if (!ratingId) {
        return new Response(
            JSON.stringify({ ok: false, error: "Falta rating_id" }),
            { status: 400, headers: { "Content-Type": "application/json" } }
        );
    }

    if (!ALLOWED_TABLES.includes(table as AllowedTable)) {
        return new Response(
            JSON.stringify({ ok: false, error: "Tabla no válida" }),
            { status: 400, headers: { "Content-Type": "application/json" } }
        );
    }

    // Marcar como revisado (needs_review → false), mantener visible
    const { data, error } = await supabaseAdmin
        .from(table)
        .update({ needs_review: false })
        .eq("id", ratingId)
        .select("id")
        .single();

    if (error) {
        const status = error.code === "PGRST116" ? 404 : 500;
        const message =
            status === 404
                ? "No se encontró el registro"
                : "No se pudo marcar como revisado";
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
