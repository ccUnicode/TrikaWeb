export const prerender = false;

import type { APIRoute } from "astro";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { validateAdminSession } from "../../../lib/adminAuth";
import moderationConfig from "../../../../config/moderation.json";

const bannedWords = (moderationConfig.bannedWords ?? []).map((w) =>
  w.toLowerCase()
);

export const POST: APIRoute = async ({ request, cookies }) => {
  // Validate session from cookie
  const isValid = await validateAdminSession(cookies);
  if (!isValid) {
    return new Response(
      JSON.stringify({ ok: false, error: "Sesión inválida" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ ok: false, error: "JSON inválido" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const ratingId = Number(body?.rating_id ?? 0);

  if (!ratingId) {
    return new Response(
      JSON.stringify({ ok: false, error: "Falta rating_id" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const { data, error } = await supabaseAdmin
    .from("teacher_ratings")
    .update({ is_hidden: true })
    .eq("id", ratingId)
    .select("id, comment")
    .single();

  if (error) {
    const status = error.code === "PGRST116" ? 404 : 500;
    const message =
      status === 404
        ? "No se encontró el comentario"
        : "No se pudo ocultar el comentario";
    if (status === 500) {
      console.error("Error hide-comment:", error);
    }
    return new Response(
      JSON.stringify({ ok: false, error: message }),
      { status, headers: { "Content-Type": "application/json" } }
    );
  }

  const commentText = (data?.comment ?? "").toLowerCase();
  const matches =
    commentText && bannedWords.length
      ? bannedWords.filter((word) => commentText.includes(word))
      : [];

  return new Response(
    JSON.stringify({
      ok: true,
      rating_id: ratingId,
      hidden: true,
      matches: matches.length ? matches : undefined,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
};
