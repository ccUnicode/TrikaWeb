export const prerender = false;

import type { APIRoute } from "astro";
import { Buffer } from "node:buffer";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { getVisibleSheetById } from "../../../../lib/server/getVisibleSheet";

type FileType = "exam" | "solution";

const sanitizeFilenameSegment = (value: unknown, fallback: string): string => {
  const normalized = String(value ?? "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9_-]/g, "");

  return normalized || fallback;
};

/**
 * GET /api/sheets/:id/file
 *
 * Sirve el PDF de una plancha o solucionario.
 *
 * Modos:
 * - redirect: genera una URL firmada y redirige.
 * - stream: muestra el archivo directamente.
 * - download: fuerza la descarga.
 *
 * Solo permite acceder cuando la plancha y su curso están visibles.
 */
export const GET: APIRoute = async ({ params, request }) => {
  const sheetId = Number(params.id);

  if (!Number.isSafeInteger(sheetId) || sheetId <= 0) {
    return new Response("Not found", {
      status: 404,
    });
  }

  const requestUrl = new URL(request.url);
  const mode = requestUrl.searchParams.get("mode");

  const requestedType = requestUrl.searchParams.get("type") ?? "exam";

  if (requestedType !== "exam" && requestedType !== "solution") {
    return new Response("Invalid file type", {
      status: 400,
    });
  }

  const fileType: FileType = requestedType;
  const streamMode = mode === "stream" || mode === "download";

  /*
   * La consulta usa supabaseAdmin, por lo que se valida
   * explícitamente la visibilidad de la plancha y del curso.
   */
  const { data: sheet, error: sheetError } = await getVisibleSheetById(sheetId);

  if (sheetError) {
    console.error(
      "Error al validar la plancha antes de servir el archivo:",
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

  let storagePath: string | null;
  let bucket: "exams" | "solutions";

  if (fileType === "solution") {
    if (sheet.solution_kind !== "pdf" || !sheet.solution_storage_path) {
      return new Response("Not found", {
        status: 404,
      });
    }

    storagePath = sheet.solution_storage_path;
    bucket = "solutions";
  } else {
    storagePath = sheet.exam_storage_path;
    bucket = "exams";
  }

  if (!storagePath) {
    return new Response("Not found", {
      status: 404,
    });
  }

  if (streamMode) {
    const { data: fileData, error: downloadError } = await supabaseAdmin.storage
      .from(bucket)
      .download(storagePath);

    if (downloadError || !fileData) {
      console.error("Error descargando PDF:", downloadError);

      return new Response("Download error", {
        status: 500,
      });
    }

    const buffer = Buffer.from(await fileData.arrayBuffer());

    const course = Array.isArray(sheet.courses)
      ? sheet.courses[0]
      : sheet.courses;

    const courseCode = sanitizeFilenameSegment(course?.code, "plancha");

    const examType = sanitizeFilenameSegment(sheet.exam_type, "examen");

    const cycle = sanitizeFilenameSegment(sheet.cycle, "sin-ciclo");

    const suffix = fileType === "solution" ? "-solucionario" : "";

    const filename = `${courseCode}-${examType}-${cycle}${suffix}.pdf`;

    const disposition = mode === "download" ? "attachment" : "inline";

    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${disposition}; filename="${filename}"`,
        "Cache-Control": "private, max-age=600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }

  const { data: signedData, error: signedError } = await supabaseAdmin.storage
    .from(bucket)
    .createSignedUrl(storagePath, 120);

  if (signedError || !signedData?.signedUrl) {
    console.error("Error generando URL firmada:", signedError);

    return new Response("Sign error", {
      status: 500,
    });
  }

  return Response.redirect(signedData.signedUrl, 302);
};
