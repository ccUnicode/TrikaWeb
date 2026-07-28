// src/pages/api/admin/reset-interest.ts
// Resets the interest count for a specific sheet (admin only)

export const prerender = false;

import type { APIRoute } from "astro";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { validateAdminSession } from "../../../lib/adminAuth";

export const POST: APIRoute = async ({ request, cookies }) => {
  // Validate admin session token against Supabase Auth
  const isAdmin = await validateAdminSession(cookies);
  if (!isAdmin) {
    return Response.json(
      { ok: false, error: "No autorizado" },
      { status: 401 }
    );
  }

  // Isolate JSON parsing to return 400 on malformed body
  let body: any;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { ok: false, error: "JSON inválido o cuerpo vacío" },
      { status: 400 }
    );
  }

  const sheetId = Number(body.sheet_id);

  if (!Number.isFinite(sheetId) || sheetId <= 0) {
    return Response.json(
      { ok: false, error: "sheet_id inválido" },
      { status: 400 }
    );
  }

  try {
    // Atomic reset via RPC (delete + update in a single transaction)
    const { error: rpcError } = await supabaseAdmin
      .rpc('reset_sheet_interest', { p_sheet_id: sheetId });

    if (rpcError) {
      console.error("Error in reset_sheet_interest RPC:", rpcError);
      return Response.json(
        { ok: false, error: "Error al reiniciar contador" },
        { status: 500 }
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
