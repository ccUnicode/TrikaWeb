export const prerender = false;

import type { APIRoute } from "astro";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { validateAdminSession } from "../../../lib/adminAuth";

export const GET: APIRoute = async ({ cookies }) => {
  try {
    const isAdmin = await validateAdminSession(cookies);

    if (!isAdmin) {
      return Response.json(
        {
          ok: false,
          error: "No autorizado",
        },
        {
          status: 401,
        },
      );
    }

    const { data, error } = await supabaseAdmin
      .from("cycles")
      .select("cycle_id, cycle_code, year, term")
      .order("year", { ascending: false })
      .order("term", { ascending: true });

    if (error) {
      console.error("Error al cargar los ciclos:", error);

      return Response.json(
        {
          ok: false,
          error: "No se pudieron cargar los ciclos",
        },
        {
          status: 500,
        },
      );
    }

    return Response.json(
      {
        ok: true,
        cycles: data ?? [],
      },
      {
        status: 200,
      },
    );
  } catch (error) {
    console.error("Error inesperado en GET /api/admin/cycles:", error);

    return Response.json(
      {
        ok: false,
        error: "Ocurrió un error al procesar la solicitud",
      },
      {
        status: 500,
      },
    );
  }
};
