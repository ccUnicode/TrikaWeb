// src/pages/api/admin/upload.ts

export const prerender = false; // necesario para aceptar POST

import type { APIRoute } from "astro";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { Buffer } from "node:buffer";

export const GET: APIRoute = () => {
  return new Response(
    JSON.stringify({ ok: true, route: "/api/admin/upload" }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
};

export const POST: APIRoute = async ({ request }) => {
  // 1) Verificar Content-Type
  const contentType = request.headers.get("content-type") || "";

  if (
    !contentType.startsWith("multipart/form-data") &&
    !contentType.startsWith("application/x-www-form-urlencoded")
  ) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: `Content-Type inválido: ${contentType}`,
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // 2) Leer formulario
  const formData = await request.formData();

  const adminPass = String(formData.get("admin_pass") ?? "").trim();
  const courseId = String(formData.get("course_id") ?? "").trim();
  const examType = String(formData.get("exam_type") ?? "").trim();
  const cycle = String(formData.get("cycle") ?? "").trim();
  const teacherHint = String(formData.get("teacher_hint") ?? "").trim();
  const resourceKind = String(formData.get("resource_kind") ?? "").trim().toUpperCase(); // PLANCHA / SOLUCIONARIO
  const file = formData.get("file") as File | null;

  // 3) Validar clave ADMIN_PASS
  if (adminPass !== (import.meta.env.ADMIN_PASS as string)) {
    return new Response(
      JSON.stringify({ ok: false, error: "Clave de administrador incorrecta" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  // 4) Validar campos
  if (!courseId || !examType || !cycle || !resourceKind || !file) {
    return new Response(
      JSON.stringify({ ok: false, error: "Faltan campos o archivo" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  if (!["PLANCHA", "SOLUCIONARIO"].includes(resourceKind)) {
    return new Response(
      JSON.stringify({ ok: false, error: "resource_kind inválido" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    const numericCourseId = Number(courseId);
    if (Number.isNaN(numericCourseId)) {
      return new Response(
        JSON.stringify({ ok: false, error: "course_id debe ser numérico" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const bucket = resourceKind === "SOLUCIONARIO" ? "solutions" : "exams";

    // 5) Subir archivo a Storage
    const arrayBuffer = await file.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);

    // ruta interna dentro del bucket, ej: "1/2024-II/PC_N1_nombre.pdf"
    const safeCycle = cycle.replace(/[^a-zA-Z0-9-_]/g, "_");
    const safeTitle = examType.replace(/[^a-zA-Z0-9-_]/g, "_");
    const path = `${numericCourseId}/${safeCycle}/${Date.now()}_${safeTitle}.pdf`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from(bucket)
      .upload(path, fileBuffer, {
        contentType: "application/pdf",
        upsert: false,
      });

    if (uploadError) {
      console.error("Error al subir a Storage:", uploadError);
      return new Response(
        JSON.stringify({ ok: false, error: "Error al subir el archivo a Storage" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const { data: existingSheet, error: lookupError } = await supabaseAdmin
      .from("sheets")
      .select("id")
      .eq("course_id", numericCourseId)
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

    if (resourceKind === "PLANCHA") {
      const insertPayload = {
        course_id: numericCourseId,
        cycle,
        exam_type: examType,
        exam_storage_path: path,
        teacher_hint: teacherHint || null,
      };

      if (existingSheet) {
        const updatePayload: Record<string, unknown> = {
          exam_storage_path: path,
        };
        if (teacherHint) {
          updatePayload.teacher_hint = teacherHint;
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
          solution_storage_path: path,
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

    // 7) Todo ok
    const action =
      resourceKind === "PLANCHA" ? "Plancha" : "Solucionario";

    return new Response(
      JSON.stringify({
        ok: true,
        message: `${action} guardado correctamente`,
        bucket,
        path,
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
