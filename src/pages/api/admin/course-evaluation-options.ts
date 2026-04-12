export const prerender = false;

import type { APIRoute } from "astro";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { validateAdminSession } from "../../../lib/adminAuth";

export const POST: APIRoute = async ({ request, cookies }) => {
    try {
        const isAdmin = await validateAdminSession(cookies);

        if (!isAdmin) {
            return new Response(
                JSON.stringify({
                    ok: false,
                    error: "No autorizado",
                }),
                {
                    status: 401,
                    headers: { "Content-Type": "application/json" },
                }
            );
        }

        const body = await request.json().catch(() => null);
        const system_id = Number(body?.system_id);

        if (!Number.isInteger(system_id) || system_id <= 0) {
            return new Response(
                JSON.stringify({
                    ok: false,
                    error: "system_id inválido",
                }),
                {
                    status: 400,
                    headers: { "Content-Type": "application/json" },
                }
            );
        }

        const { data, error } = await supabaseAdmin.rpc(
            "get_variable_evaluations_by_system",
            {
                p_system_id: system_id,
            }
        );

        if (error) {
            console.error("Error RPC get_variable_evaluations_by_system:", error);
            return new Response(
                JSON.stringify({
                    ok: false,
                    error: error.message || "Error obteniendo evaluaciones",
                }),
                {
                    status: 500,
                    headers: { "Content-Type": "application/json" },
                }
            );
        }

        return new Response(
            JSON.stringify({
                ok: true,
                evaluations: data || [],
            }),
            {
                status: 200,
                headers: { "Content-Type": "application/json" },
            }
        );
    } catch (err) {
        console.error("Error en course-evaluation-options:", err);

        return new Response(
            JSON.stringify({
                ok: false,
                error: err instanceof Error ? err.message : "Error interno",
            }),
            {
                status: 500,
                headers: { "Content-Type": "application/json" },
            }
        );
    }
};