export const prerender = false;

import type { APIRoute } from "astro";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { validateAdminSession } from "../../../lib/adminAuth";

export const POST: APIRoute = async ({ cookies }) => {
    const isValid = await validateAdminSession(cookies);
    if (!isValid) {
        return new Response(
            JSON.stringify({ ok: false, error: "Sesión inválida" }),
            { status: 401, headers: { "Content-Type": "application/json" } }
        );
    }

    // Conteo de teacher_ratings pendientes de revisión
    const { count: teacherCount, error: teacherError } = await supabaseAdmin
        .from("teacher_ratings")
        .select("id", { count: "exact", head: true })
        .eq("needs_review", true)
        .eq("is_hidden", false);

    if (teacherError) {
        console.error("Error counting teacher pending:", teacherError);
    }

    // Conteo de sheet_feedback pendientes de revisión
    const { count: sheetCountRaw, error: sheetError } = await supabaseAdmin
        .from("sheet_feedback")
        .select("id", { count: "exact", head: true })
        .eq("needs_review", true)
        .eq("is_hidden", false);

    if (sheetError) {
        console.error("Error counting sheet pending:", sheetError);
    }
    let sheetCount = sheetCountRaw ?? 0;

    return new Response(
        JSON.stringify({
            ok: true,
            teachers: teacherCount ?? 0,
            sheets: sheetCount ?? 0,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
    );
};
