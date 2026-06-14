// src/pages/api/admin/upload.ts
// Registers sheet metadata in the DB after the file has already been
// uploaded directly to Supabase Storage by the browser.

export const prerender = false;

import type { APIRoute } from "astro";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { validateAdminSession } from "../../../lib/adminAuth";

export const GET: APIRoute = () => {
  return new Response(
    JSON.stringify({ ok: true, route: "/api/admin/upload" }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
};

export const POST: APIRoute = async ({ request, cookies }) => {
  // Validate admin session via cookie
  const isAdmin = await validateAdminSession(cookies);
  if (!isAdmin) {
    return new Response(
      JSON.stringify({ ok: false, error: "No autorizado. Inicia sesión como admin." }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  // Parse JSON body (metadata only, no file)
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return new Response(
      JSON.stringify({ ok: false, error: "Body JSON inválido" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const courseId = Number(body.course_id);
  const cycle = String(body.cycle ?? "").trim();
  const examType = String(body.exam_type ?? "").trim();
  const resourceKindRaw = String(body.resource_kind ?? "").trim().toUpperCase();
  const storagePath = String(body.storage_path ?? "").trim();
  const teacherHint = String(body.teacher_hint ?? "").trim();
  const solutionStoragePathRaw = String(body.solution_storage_path ?? "").trim();
  const thumbStoragePath = String(body.thumb_storage_path ?? "").trim() || null;

  if (!courseId || Number.isNaN(courseId) || !cycle || !examType || !resourceKindRaw || !storagePath) {
    return new Response(
      JSON.stringify({ ok: false, error: "Faltan campos requeridos" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  if (!["PLANCHA", "SOLUCIONARIO", "AMBOS"].includes(resourceKindRaw)) {
    return new Response(
      JSON.stringify({ ok: false, error: "resource_kind inválido" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const treatsExamSide = resourceKindRaw !== "SOLUCIONARIO";
  // Subida conjunta: la decide el backend por paths recibidos, no solo por resource_kind === "AMBOS".
  const hasSolutionAttachment = treatsExamSide && solutionStoragePathRaw.length > 0;
  const isCombinedExamAndSolution = hasSolutionAttachment;

  if (resourceKindRaw === "AMBOS" && !hasSolutionAttachment) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: "AMBOS requiere solution_storage_path con la clave del PDF en el bucket solutions",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  if (
    resourceKindRaw === "SOLUCIONARIO" &&
    solutionStoragePathRaw.length > 0 &&
    solutionStoragePathRaw !== storagePath
  ) {
    return new Response(
      JSON.stringify({
        ok: false,
        error:
          "Para SOLUCIONARIO use solo storage_path; no envíe solution_storage_path distinto",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    // Check existing sheet
    const { data: existingSheet, error: lookupError } = await supabaseAdmin
      .from("sheets")
      .select("id")
      .eq("course_id", courseId)
      .eq("cycle", cycle)
      .eq("exam_type", examType)
      .maybeSingle();

    if (lookupError) {
      console.error("Error al buscar sheet existente:", lookupError);
      return new Response(
        JSON.stringify({ ok: false, error: "No se pudo validar la plancha" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    if (treatsExamSide) {
      const insertPayload = {
        course_id: courseId,
        cycle,
        exam_type: examType,
        exam_storage_path: storagePath,
        teacher_hint: teacherHint || null,
        thumb_storage_path: thumbStoragePath,
        is_hidden: false,
        ...(isCombinedExamAndSolution
          ? {
              solution_kind: "pdf",
              solution_storage_path: solutionStoragePathRaw,
            }
          : {}),
      };

      if (existingSheet) {
        const updatePayload: Record<string, unknown> = {
          exam_storage_path: storagePath,
        };
        if (teacherHint) {
          updatePayload.teacher_hint = teacherHint;
        }
        if (thumbStoragePath) {
          updatePayload.thumb_storage_path = thumbStoragePath;
        }
        if (isCombinedExamAndSolution && solutionStoragePathRaw) {
          updatePayload.solution_kind = "pdf";
          updatePayload.solution_storage_path = solutionStoragePathRaw;
        }

        const { error: updateError } = await supabaseAdmin
          .from("sheets")
          .update(updatePayload)
          .eq("id", existingSheet.id);

        if (updateError) {
          console.error("Error al actualizar sheet:", updateError);
          return new Response(
            JSON.stringify({
              ok: false,
              error: "El archivo se subió, pero no se pudo actualizar la plancha",
            }),
            { status: 500, headers: { "Content-Type": "application/json" } }
          );
        }
      } else {
        const { error: insertError } = await supabaseAdmin
          .from("sheets")
          .insert([insertPayload]);

        if (insertError) {
          console.error("Error al insertar sheet:", insertError);
          return new Response(
            JSON.stringify({
              ok: false,
              error: "Archivo subido, pero falló el registro de la plancha",
            }),
            { status: 500, headers: { "Content-Type": "application/json" } }
          );
        }
      }
    } else {
      if (!existingSheet) {
        return new Response(
          JSON.stringify({
            ok: false,
            error: "Primero sube la plancha antes de adjuntar un solucionario",
          }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      const { error: updateSolutionError } = await supabaseAdmin
        .from("sheets")
        .update({
          solution_kind: "pdf",
          solution_storage_path: storagePath,
        })
        .eq("id", existingSheet.id);

      if (updateSolutionError) {
        console.error("Error al actualizar solucionario:", updateSolutionError);
        return new Response(
          JSON.stringify({
            ok: false,
            error: "Archivo subido, pero no se pudo registrar el solucionario",
          }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    const action = isCombinedExamAndSolution
      ? "Plancha y Solucionario"
      : treatsExamSide
        ? "Plancha"
        : "Solucionario";

    return new Response(
      JSON.stringify({
        ok: true,
        message: `${action} guardado correctamente`,
        path: storagePath,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error inesperado en /api/admin/upload:", err);
    return new Response(
      JSON.stringify({ ok: false, error: "Error interno en el servidor" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};
