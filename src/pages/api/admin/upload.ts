export const prerender = false;

import type { APIRoute } from "astro";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { validateAdminSession } from "../../../lib/adminAuth";

export const GET: APIRoute = () => {
  return new Response(
    JSON.stringify({ ok: true, route: "/api/admin/upload" }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
};

export const POST: APIRoute = async ({ request, cookies }) => {
  const isAdmin = await validateAdminSession(cookies);
  if (!isAdmin) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: "No autorizado. Inicia sesión como admin.",
      }),
      { status: 401, headers: { "Content-Type": "application/json" } },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return new Response(
      JSON.stringify({ ok: false, error: "Body JSON inválido" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const courseId = Number(body.course_id);
  const cycle = String(body.cycle ?? "").trim();
  const evaluationId = Number(body.evaluation_id);
  const examType = String(body.exam_type ?? "").trim();
  const resourceKind = String(body.resource_kind ?? "")
    .trim()
    .toUpperCase();
  const storagePath = String(body.storage_path ?? "").trim();
  const teacherHint = String(body.teacher_hint ?? "").trim();
  const solutionStoragePath = String(body.solution_storage_path ?? "").trim();

<<<<<<< HEAD
  if (
    !courseId ||
    Number.isNaN(courseId) ||
    !cycle ||
    !examType ||
    !resourceKind ||
    !storagePath
  ) {
=======
  if (!courseId || Number.isNaN(courseId) || !evaluationId || Number.isNaN(evaluationId) || !cycle || !examType || !resourceKind || !storagePath) {
>>>>>>> 4216c7c (feat: dropdown tipo de evaluación)
    return new Response(
      JSON.stringify({ ok: false, error: "Faltan campos requeridos" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  if (!["PLANCHA", "SOLUCIONARIO", "AMBOS"].includes(resourceKind)) {
    return new Response(
      JSON.stringify({ ok: false, error: "resource_kind inválido" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  try {
    const { data: existingSheet, error: lookupError } = await supabaseAdmin
      .from("sheets")
      .select("id")
      .eq("course_id", courseId)
      .eq("cycle", cycle)
      .eq("evaluation_id", evaluationId)
      .maybeSingle();

    if (lookupError) {
      console.error("Error al buscar sheet existente:", lookupError);
      return new Response(
        JSON.stringify({ ok: false, error: "No se pudo validar la plancha" }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }

    if (resourceKind === "PLANCHA" || resourceKind === "AMBOS") {
      const insertPayload = {
        course_id: courseId,
        cycle,
        evaluation_id: evaluationId,
        exam_type: examType,
        exam_storage_path: storagePath,
        teacher_hint: teacherHint || null,
        thumb_storage_path: thumbStoragePath,
        is_hidden: false,
        ...(resourceKind === "AMBOS"
          ? {
              solution_kind: "pdf",
              solution_storage_path: solutionStoragePath,
            }
          : {}),
      };

      if (existingSheet) {
        const updatePayload: Record<string, unknown> = {
          evaluation_id: evaluationId,
          exam_type: examType,
          exam_storage_path: storagePath,
        };

        if (teacherHint) {
          updatePayload.teacher_hint = teacherHint;
        }
        if (thumbStoragePath) {
          updatePayload.thumb_storage_path = thumbStoragePath;
        }
        if (resourceKind === "AMBOS" && solutionStoragePath) {
          updatePayload.solution_kind = "pdf";
          updatePayload.solution_storage_path = solutionStoragePath;
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
              error:
                "El archivo se subió, pero no se pudo actualizar la plancha",
            }),
            { status: 500, headers: { "Content-Type": "application/json" } },
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
            { status: 500, headers: { "Content-Type": "application/json" } },
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
          { status: 400, headers: { "Content-Type": "application/json" } },
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
          { status: 500, headers: { "Content-Type": "application/json" } },
        );
      }
    }

    const action =
      resourceKind === "AMBOS"
        ? "Plancha y Solucionario"
        : resourceKind === "PLANCHA"
<<<<<<< HEAD
          ? "Plancha"
          : "Solucionario";
=======
        ? "Plancha"
        : "Solucionario";
>>>>>>> 4216c7c (feat: dropdown tipo de evaluación)

    return new Response(
      JSON.stringify({
        ok: true,
        message: `${action} guardado correctamente`,
        path: storagePath,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("Error inesperado en /api/admin/upload:", err);
    return new Response(
      JSON.stringify({ ok: false, error: "Error interno en el servidor" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
};