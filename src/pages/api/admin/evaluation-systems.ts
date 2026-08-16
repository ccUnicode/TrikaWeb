export const prerender = false;

import type { APIRoute } from "astro";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { validateAdminSession } from "../../../lib/adminAuth";

export const GET: APIRoute = async ({ cookies }) => {
  try {
    const isAdmin = await validateAdminSession(cookies);
    if (!isAdmin) {
      return Response.json(
        { ok: false, error: "No autorizado" },
        { status: 401 }
      );
    }

    const { data, error } = await supabaseAdmin.rpc("get_evaluation_systems");

    if (error) throw error;

    return Response.json(
      { ok: true, systems: data },
      { status: 200 }
    );

  } catch (err) {
    console.error(err);
    return Response.json(
      { ok: false, error: "Error interno del servidor" },
      { status: 500 }
    );
  }
};