// src/pages/api/admin/upload-url.ts
// Generates a signed upload URL so the browser can upload PDFs
// directly to Supabase Storage, bypassing Vercel's 4.5 MB body limit.

export const prerender = false;

import type { APIRoute } from "astro";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { validateAdminSession } from "../../../lib/adminAuth";

export const POST: APIRoute = async ({ request, cookies }) => {
  // Validate admin session via cookie
  const isAdmin = await validateAdminSession(cookies);
  if (!isAdmin) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: "No autorizado. Inicia sesión como admin.",
      }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  // Parse JSON body
  let body: Record<string, any>;
  try {
    body = await request.json();
  } catch {
    return new Response(
      JSON.stringify({ ok: false, error: "Body JSON inválido" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const courseId = Number(body.course_id);
  const courseCode = String(body.course_code ?? "").trim().toUpperCase();
  const cycle = String(body.cycle ?? "").trim();
  const evaluationId = Number(body.evaluation_id);
  const resourceKind = String(body.resource_kind ?? "").trim().toUpperCase();
  const teacherHint = String(body.teacher_hint ?? "").trim();
  const isTeacherSpecific = Boolean(body.is_teacher_specific);

  if (
    !Number.isInteger(courseId) ||
    courseId <= 0 ||
    !courseCode ||
    !cycle ||
    !Number.isInteger(evaluationId) ||
    evaluationId <= 0 ||
    !resourceKind
  ) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: "Faltan campos obligatorios o son inválidos",
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  // Validate cycle code in DB
  const { data: cycleExists, error: cycleError } = await supabaseAdmin
    .from("cycles")
    .select("cycle_id")
    .eq("cycle_code", cycle)
    .maybeSingle();

  if (cycleError) {
    return new Response(
      JSON.stringify({ ok: false, error: "Error validando ciclo" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  if (!cycleExists) {
    return new Response(
      JSON.stringify({ ok: false, error: "Ciclo inválido" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // If marked as teacher-specific, teacher_hint is required
  if (isTeacherSpecific && !teacherHint) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: "Debes indicar el docente para una plancha de profesor específico",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  if (!["PLANCHA", "SOLUCIONARIO", "AMBOS"].includes(resourceKind)) {
    return new Response(
      JSON.stringify({ ok: false, error: "resource_kind inválido" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const { data: evaluation, error: evaluationError } = await supabaseAdmin
    .from("evaluation_type")
    .select("evaluation_id, evaluation_name, evaluation_abr")
    .eq("evaluation_id", evaluationId)
    .single();

  if (evaluationError || !evaluation) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: "No se encontró la evaluación seleccionada",
      }),
      {
        status: 404,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  const examType = String(evaluation.evaluation_abr ?? "").trim().toUpperCase();

  if (!examType) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: "La evaluación seleccionada no tiene abreviatura válida",
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  // Resolve course
  const { data: course, error: courseError } = await supabaseAdmin
    .from("courses")
    .select("id, code")
    .eq("id", courseId)
    .single();

  if (courseError || !course) {
    return new Response(
      JSON.stringify({ ok: false, error: "course_id no encontrado" }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }

  const normalizedCode = String(course.code ?? "").trim().toUpperCase();

  if (!normalizedCode || normalizedCode !== courseCode) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: "El course_id no coincide con el course_code enviado",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // Build storage path & bucket
  // For teacher-specific sheets, append sanitized teacher name to avoid collisions
  // General:  BMA02/PC1/2024-II.pdf
  // Specific: BMA02/PC1/2024-II_Arambulo.pdf
  const bucket = resourceKind === "SOLUCIONARIO" ? "solutions" : "exams";
  const safeCycle = cycle.replace(/[^a-zA-Z0-9\-_]/g, "_");
  const safeExam = examType.replace(/[^a-zA-Z0-9\-_]/g, "_");
  const safeTeacher = teacherHint
    ? `_${teacherHint
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/ñ/g, "n")
        .replace(/Ñ/g, "N")
        .replace(/[^a-zA-Z0-9\-_]/g, "_")}`
    : "";
  const path = `${normalizedCode}/${safeExam}/${safeCycle}${safeTeacher}.pdf`;

  let signedUrl: string | undefined;
  let token: string | undefined;
  let solutionSignedUrl: string | undefined;
  let solutionPath: string | undefined;

  if (resourceKind === "AMBOS") {
    // Generate signed URL for Plancha
    const { data: pData, error: pError } = await supabaseAdmin.storage
      .from("exams")
      .createSignedUploadUrl(path, { upsert: true });

    // Generate signed URL for Solucionario
    solutionPath = `${normalizedCode}/${safeExam}/${safeCycle}${safeTeacher}.pdf`;
    const { data: sData, error: sError } = await supabaseAdmin.storage
      .from("solutions")
      .createSignedUploadUrl(solutionPath, { upsert: true });

    if (pError || !pData || sError || !sData) {
      console.error(
        "Error creating signed upload URLs for AMBOS:",
        pError,
        sError
      );
      return new Response(
        JSON.stringify({
          ok: false,
          error: "No se pudo generar URLs de subida conjunta.",
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
    signedUrl = pData.signedUrl;
    token = pData.token;
    solutionSignedUrl = sData.signedUrl;
  } else {
    // Generate signed upload URL for the single file
    const { data: signedData, error: signedError } = await supabaseAdmin.storage
      .from(bucket)
      .createSignedUploadUrl(path, { upsert: true });

    if (signedError || !signedData) {
      console.error("Error creating signed upload URL:", signedError);
      return new Response(
        JSON.stringify({
          ok: false,
          error: "No se pudo generar la URL de subida. ¿El archivo ya existe?",
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
    signedUrl = signedData.signedUrl;
    token = signedData.token;
  }

  // Optional: Generate signed upload URL for thumbnail if it's a Plancha
  let thumbSignedUrl: string | undefined = undefined;
  let thumbPath: string | undefined = undefined;

  if (resourceKind === "PLANCHA" || resourceKind === "AMBOS") {
    thumbPath = `${normalizedCode}/${safeExam}/${safeCycle}${safeTeacher}.jpg`;
    const { data: thumbData, error: thumbError } = await supabaseAdmin.storage
      .from("thumbnails")
      .createSignedUploadUrl(thumbPath, { upsert: true });

    if (!thumbError && thumbData) {
      thumbSignedUrl = thumbData.signedUrl;
    } else {
      console.error(
        "Error creating signed upload URL for thumbnail:",
        thumbError
      );
      // Non-fatal, we can still upload the PDF even if thumb url fails
    }
  }

  return new Response(
    JSON.stringify({
      ok: true,
      signedUrl,
      token,
      path,
      bucket: resourceKind === "AMBOS" ? "exams" : bucket,
      courseId,
      examType,
      thumbSignedUrl,
      thumbPath,
      solutionSignedUrl,
      solutionPath,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
};
