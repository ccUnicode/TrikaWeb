export const prerender = false;

import type { APIRoute } from "astro";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { getVisibleSheetById } from "../../../../lib/server/getVisibleSheet";

/**
 * GET /api/sheets/:id/solution
 *
 * Redirige al solucionario de una plancha.
 *
 * Soporta:
 * - PDF almacenado en Supabase Storage.
 * - Video mediante URL externa.
 *
 * Solo permite acceder cuando la plancha y su curso están visibles.
 */
export const GET: APIRoute = async ({ params }) => {
  const sheetId = Number(params.id);

  if (!Number.isSafeInteger(sheetId) || sheetId <= 0) {
    return new Response("Not found", {
      status: 404,
    });
  }

  /*
   * Validación explícita porque supabaseAdmin ignora las políticas RLS.
   */
  const { data: sheet, error: sheetError } = await getVisibleSheetById(sheetId);

  if (sheetError) {
    console.error(
      "Error al validar la plancha antes de abrir el solucionario:",
      sheetError,
    );

    return new Response("Internal server error", {
      status: 500,
    });
  }

  if (!sheet) {
    return new Response("Not found", {
      status: 404,
    });
  }

  if (sheet.solution_kind === "pdf" && sheet.solution_storage_path) {
    const { data, error } = await supabaseAdmin.storage
      .from("solutions")
      .createSignedUrl(sheet.solution_storage_path, 120);

    if (error || !data?.signedUrl) {
      console.error("Error generando URL firmada del solucionario:", error);

      return new Response("Sign error", {
        status: 500,
      });
    }

    return Response.redirect(data.signedUrl, 302);
  }

  if (sheet.solution_kind === "video" && sheet.solution_video_url) {
    let videoUrl: URL;

    try {
      videoUrl = new URL(sheet.solution_video_url);
    } catch {
      console.error("URL de video inválida:", sheet.solution_video_url);

      return new Response("Invalid solution URL", {
        status: 500,
      });
    }

    if (videoUrl.protocol !== "https:" && videoUrl.protocol !== "http:") {
      return new Response("Invalid solution URL", {
        status: 500,
      });
    }

    return Response.redirect(videoUrl.toString(), 302);
  }

  return new Response("No solution", {
    status: 404,
  });
};
