export const prerender = false;

import type { APIRoute } from "astro";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { validateAdminSession } from "../../../lib/adminAuth";

const ALLOWED_TABLES = ["teacher_ratings", "sheet_feedback"] as const;
type AllowedTable = typeof ALLOWED_TABLES[number];

export const PATCH: APIRoute = async ({ request, cookies }) => {
  const isValid = await validateAdminSession(cookies);
  if (!isValid) {
    return Response.json(
      { ok: false, error: "Sesión inválida" },
      { status: 401 }
    );
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { ok: false, error: "JSON inválido" },
      { status: 400 }
    );
  }

  const ratingId = Number(body?.rating_id ?? 0);
  const table = (body?.table ?? "teacher_ratings") as string;

  if (!ratingId) {
    return Response.json(
      { ok: false, error: "Falta rating_id" },
      { status: 400 }
    );
  }

  if (!ALLOWED_TABLES.includes(table as AllowedTable)) {
    return Response.json(
      { ok: false, error: "Tabla no válida" },
      { status: 400 }
    );
  }

  // Desocultar (si es necesario forzar needs_review, esto solo desoculta)
  const { data, error } = await supabaseAdmin
    .from(table)
    .update({ is_hidden: false })
    .eq("id", ratingId)
    .select("id")
    .single();

  if (error) {
    const status = error.code === "PGRST116" ? 404 : 500;
    const message =
      status === 404
        ? "No se encontró el registro"
        : "No se pudo restaurar el registro";
    if (status === 500) {
      console.error("Error unhide-comment:", error);
    }
    return Response.json(
      { ok: false, error: message },
      { status }
    );
  }

  return Response.json(
    {
      ok: true,
      rating_id: ratingId,
      hidden: false,
    },
    { status: 200 }
  );
};
