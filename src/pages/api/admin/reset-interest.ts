export const prerender = false;

import type { APIRoute } from "astro";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { validateAdminSession } from "../../../lib/adminAuth";

interface ResetInterestBody {
  sheet_id?: unknown;
}

/**
 * POST /api/admin/reset-interest
 *
 * Reinicia los registros de interés asociados a una plancha.
 *
 * La operación se ejecuta mediante una función RPC de PostgreSQL que:
 * - Bloquea la fila correspondiente en sheets.
 * - Elimina los registros de sheet_interests.
 * - Recalcula interest_count.
 * - Ejecuta todos los cambios dentro de una única transacción.
 *
 * Requiere una sesión administrativa válida.
 */
export const POST: APIRoute = async ({ request, cookies }) => {
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

  let body: ResetInterestBody;

  try {
    body = (await request.json()) as ResetInterestBody;
  } catch {
    return Response.json(
      {
        ok: false,
        error: "Cuerpo de petición inválido o vacío",
      },
      {
        status: 400,
      },
    );
  }

  const sheetId = Number(body.sheet_id);

  if (!Number.isSafeInteger(sheetId) || sheetId <= 0) {
    return Response.json(
      {
        ok: false,
        error: "sheet_id inválido",
      },
      {
        status: 400,
      },
    );
  }

  try {
    const { data: wasReset, error } = await supabaseAdmin.rpc(
      "reset_sheet_interest",
      {
        p_sheet_id: sheetId,
      },
    );

    if (error) {
      console.error("Error resetting sheet interests:", error);

      return Response.json(
        {
          ok: false,
          error: "No se pudo reiniciar el contador de interés",
        },
        {
          status: 500,
        },
      );
    }

    if (wasReset !== true) {
      return Response.json(
        {
          ok: false,
          error: "Plancha no encontrada",
        },
        {
          status: 404,
        },
      );
    }

    return Response.json(
      {
        ok: true,
        message: "Contador de interés reiniciado correctamente",
      },
      {
        status: 200,
      },
    );
  } catch (error) {
    console.error("Unexpected error in reset-interest:", error);

    return Response.json(
      {
        ok: false,
        error: "Error interno del servidor",
      },
      {
        status: 500,
      },
    );
  }
};
