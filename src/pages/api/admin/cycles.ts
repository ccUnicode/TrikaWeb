export const prerender = false;

import type { APIRoute } from "astro";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { validateAdminSession } from "../../../lib/adminAuth";

export const GET: APIRoute = async ({ cookies }) => {
    const isAdmin = await validateAdminSession(cookies);

    if (!isAdmin) {
        return new Response(
            JSON.stringify({ ok: false, error: "No autorizado" }),
            { status: 401, headers: { "Content-Type": "application/json" } }
        );
    }

    const { data, error } = await supabaseAdmin
        .from("cycles")
        .select("cycle_id, cycle_code, year, term")
        .order("year", { ascending: false })
        .order("term", { ascending: true });

    if (error) {
        console.error("Error cargando ciclos:", error);

        return new Response(
            JSON.stringify({ ok: false, error: error.message }),
            { status: 500, headers: { "Content-Type": "application/json" } }
        );
    }

    return new Response(
        JSON.stringify({ ok: true, cycles: data }),
        { status: 200, headers: { "Content-Type": "application/json" } }
    );
};