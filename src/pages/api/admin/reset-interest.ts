// src/pages/api/admin/reset-interest.ts
// Resets the interest count for a specific sheet (admin only)

export const prerender = false;

import type { APIRoute } from "astro";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

export const POST: APIRoute = async ({ request }) => {
  // Check admin session cookie
  const cookie = request.headers.get("cookie") ?? "";
  if (!cookie.includes("admin_session=")) {
    return new Response(
      JSON.stringify({ ok: false, error: "No autorizado" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    const body = await request.json();
    const sheetId = Number(body.sheet_id);

    if (!Number.isFinite(sheetId) || sheetId <= 0) {
      return new Response(
        JSON.stringify({ ok: false, error: "sheet_id inválido" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // 1. Delete all interest records for this sheet
    const { error: deleteError } = await supabaseAdmin
      .from("sheet_interests")
      .delete()
      .eq("sheet_id", sheetId);

    if (deleteError) {
      console.error("Error deleting interests:", deleteError);
      return new Response(
        JSON.stringify({ ok: false, error: "Error al eliminar registros de interés" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // 2. Reset interest_count to 0 on the sheet
    const { error: updateError } = await supabaseAdmin
      .from("sheets")
      .update({ interest_count: 0 })
      .eq("id", sheetId);

    if (updateError) {
      console.error("Error resetting interest_count:", updateError);
      return new Response(
        JSON.stringify({ ok: false, error: "Error al resetear contador" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ ok: true, message: "Contador reiniciado" }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error in reset-interest:", err);
    return new Response(
      JSON.stringify({ ok: false, error: "Error interno del servidor" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};
