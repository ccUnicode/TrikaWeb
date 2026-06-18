export const prerender = false;

import type { APIRoute } from "astro";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { validateAdminSession } from "../../../lib/adminAuth";

export const POST: APIRoute = async ({ request, cookies }) => {
    try {
        const isAdmin = await validateAdminSession(cookies);

        if (!isAdmin) {
            return Response.json(
                {
                    ok: false,
                    error: "No autorizado",
                },
                { status: 401 }
            );
        }

        const body = await request.json().catch(() => null);
        const system_id = Number(body?.system_id);

        if (!Number.isInteger(system_id) || system_id <= 0) {
            return Response.json(
                {
                    ok: false,
                    error: "system_id inválido",
                },
                { status: 400 }
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
            return Response.json(
                {
                    ok: false,
                    error: "Error obteniendo evaluaciones",
                },
                { status: 500 }
            );
        }

        return Response.json(
            {
                ok: true,
                evaluations: data || [],
            },
            { status: 200 }
        );
    } catch (err) {
        console.error("Error en course-evaluation-options:", err);

        return Response.json(
            {
                ok: false,
                error: "Error interno del servidor",
            },
            { status: 500 }
        );
    }
};