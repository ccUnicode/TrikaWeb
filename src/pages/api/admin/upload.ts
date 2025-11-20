// src/pages/api/admin/upload.ts

export const prerender = false;

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

  const formData = await request.formData();
  const adminPass = String(formData.get("admin_pass") ?? "").trim();
  const courseCodeInput = String(formData.get("course_code") ?? "")
    .trim()
    .toUpperCase();
  const courseIdInput = String(formData.get("course_id") ?? "").trim();
  const examType = String(formData.get("exam_type") ?? "").trim();
  const cycle = String(formData.get("cycle") ?? "").trim();
  const teacherHint = String(formData.get("teacher_hint") ?? "").trim();
  const resourceKind = String(formData.get("resource_kind") ?? "")
    .trim()
    .toUpperCase();
  const file = formData.get("file") as File | null;

  if (adminPass !== (import.meta.env.ADMIN_PASS as string)) {
    return new Response(
      JSON.stringify({ ok: false, error: "Clave de administrador incorrecta" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  if (!courseCodeInput && !courseIdInput) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: "Falta course_code (o course_id legacy)",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  if (!examType || !cycle || !resourceKind || !file) {
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
    let courseId: number | null = null;
    let normalizedCode: string | null = null;

    if (courseCodeInput) {
      const { data: course, error: courseError } = await supabaseAdmin
        .from("courses")
        .select("id, code")
        .ilike("code", courseCodeInput)
        .single();

      if (courseError || !course) {
        return new Response(
          JSON.stringify({ ok: false, error: "course_code no encontrado" }),
          { status: 404, headers: { "Content-Type": "application/json" } }
        );
      }
      courseId = course.id;
      normalizedCode = (course.code ?? courseCodeInput).toUpperCase();
    } else if (courseIdInput) {
      const parsed = Number(courseIdInput);
      if (Number.isNaN(parsed)) {
        return new Response(
          JSON.stringify({ ok: false, error: "course_id inválido" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
      const { data: course, error: courseError } = await supabaseAdmin
        .from("courses")
        .select("id, code")
        .eq("id", parsed)
        .single();
      if (courseError || !course) {
        return new Response(
          JSON.stringify({ ok: false, error: "course_id no encontrado" }),
          { status: 404, headers: { "Content-Type": "application/json" } }
        );
      }
      courseId = course.id;
      normalizedCode = (course.code ?? "").toUpperCase() || `COURSE_${course.id}`;
    }

    if (!courseId || !normalizedCode) {
      return new Response(
        JSON.stringify({ ok: false, error: "No se pudo resolver el curso" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const bucket = resourceKind === "SOLUCIONARIO" ? "solutions" : "exams";

    const arrayBuffer = await file.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);

    const safeCycle = cycle.replace(/[^a-zA-Z0-9-_]/g, "_");
    const safeExam = examType.replace(/[^a-zA-Z0-9-_]/g, "_");
    const path = `${normalizedCode}/${safeExam}/${safeCycle}.pdf`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from(bucket)
      .upload(path, fileBuffer, {
        contentType: "application/pdf",
        upsert: false,
      });

    if (uploadError) {
      console.error("Error al subir a Storage:", uploadError);
      return new Response(
        JSON.stringify({
          ok: false,
          error: "Error al subir el archivo a Storage",
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

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

    if (resourceKind === "PLANCHA") {
      const insertPayload = {
        course_id: courseId,
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

    const action = resourceKind === "PLANCHA" ? "Plancha" : "Solucionario";

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
