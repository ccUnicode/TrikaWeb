export const prerender = false;

import type { APIRoute } from "astro";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { validateAdminSession } from "../../../lib/adminAuth";

/**
 * POST /api/admin/reset-interest
 * Admin-only. Reinicia el contador de solicitudes de solucionario de una plancha:
 * 1. Elimina todos los registros de sheet_interests para esa plancha.
 * 2. Pone interest_count = 0 en la tabla sheets.
 * No es atómico (race condition aceptable para acción admin).
 */
export const POST: APIRoute = async ({ request, cookies }) => {
  // Validate admin session token against Supabase Auth
  const isAdmin = await validateAdminSession(cookies);
  if (!isAdmin) {
    return Response.json(
      { ok: false, error: "No autorizado" },
      { status: 401 }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch (err) {
    return Response.json(
      { ok: false, error: "Cuerpo de petición inválido o vacío" },
      { status: 400 }
    );
  }

  try {
    const sheetId = Number(body?.sheet_id);

    if (!Number.isFinite(sheetId) || sheetId <= 0) {
      return Response.json(
        { ok: false, error: "sheet_id inválido" },
        { status: 400 }
      );
    }

    // Note: delete + update are not atomic. If the update fails after delete,
    // interest_count may be stale. This is acceptable for an admin-only reset
    // action since the count is eventually consistent (recalculated on next toggle).

    // 1. Delete all interest records for this sheet
    const { error: deleteError } = await supabaseAdmin
      .from("sheet_interests")
      .delete()
      .eq("sheet_id", sheetId);

    if (deleteError) {
      console.error("Error deleting interests:", deleteError);
      return Response.json(
        { ok: false, error: "Error al eliminar registros de interés" },
        { status: 500 }
      );
    }

    // 2. Reset interest_count to 0 on the sheet
    const { data: updatedSheets, error: updateError } = await supabaseAdmin
      .from("sheets")
      .update({ interest_count: 0 })
      .eq("id", sheetId)
      .select();

    if (updateError) {
      console.error("Error resetting interest_count:", updateError);
      return Response.json(
        { ok: false, error: "Error al resetear contador (registros ya eliminados)" },
        { status: 500 }
      );
    }

    if (!updatedSheets || updatedSheets.length === 0) {
      return Response.json(
        { ok: false, error: "Plancha no encontrada" },
        { status: 404 }
      );
    }

    return Response.json(
      { ok: true, message: "Contador reiniciado" },
      { status: 200 }
    );
  } catch (err) {
    console.error("Error in reset-interest:", err);
    return Response.json(
      { ok: false, error: "Error interno del servidor" },
      { status: 500 }
    );
  }
};
