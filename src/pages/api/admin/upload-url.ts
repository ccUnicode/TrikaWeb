/**
 * POST /api/admin/upload-url
 * Genera URLs de subida firmadas para que el navegador suba PDFs
 * directamente a Supabase Storage (evitando el límite de 4.5 MB de Vercel).
 *
 * Soporta:
 *  - resourceKind = "PLANCHA" | "SOLUCIONARIO" | "AMBOS"
 *  - is_teacher_specific (docente específico vs plancha general)
 *  - Miniaturas (thumbnails) de la primera página del PDF
 *  - Validación de ciclo (formato AAAA-T) con auto-insert
 *  - Validación de que exista plancha antes de subir solucionario
 */
export const prerender = false;

import type { APIRoute } from "astro";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { validateAdminSession } from "../../../lib/adminAuth";

export const POST: APIRoute = async ({ request, cookies }) => {
  // Validate admin session via cookie
  const isAdmin = await validateAdminSession(cookies);
  if (!isAdmin) {
    return Response.json(
      {
        ok: false,
        error: "No autorizado. Inicia sesión como admin.",
      },
      { status: 401 }
    );
  }

  // Parse JSON body
  let body: Record<string, any>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Body JSON inválido" }, { status: 400 });
  }

  const courseId = Number(body.course_id);
  const courseCode = String(body.course_code ?? "")
    .trim()
    .toUpperCase();
  const cycle = String(body.cycle ?? "").trim();
  const evaluationId = Number(body.evaluation_id);
  const resourceKind = String(body.resource_kind ?? "")
    .trim()
    .toUpperCase();
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
    return Response.json(
      {
        ok: false,
        error: "Faltan campos obligatorios o son inválidos",
      },
      { status: 400 }
    );
  }

  // Validate cycle code in DB
  if (!/^\d{4}-(I|II|III)$/.test(cycle)) {
    return Response.json(
      {
        ok: false,
        error: "Formato de ciclo inválido. Usa el formato 2026-I, 2026-II o 2026-III.",
      },
      { status: 400 }
    );
  }

  const { error: cycleUpsertError } = await supabaseAdmin
    .from("cycles")
    .upsert({ cycle_code: cycle }, { onConflict: "cycle_code" });

  if (cycleUpsertError) {
    console.error("Error upserting cycle:", cycleUpsertError);
    return Response.json(
      {
        ok: false,
        error: "No se pudo registrar el ciclo en la base de datos.",
      },
      { status: 500 }
    );
  }

  // If marked as teacher-specific, teacher_hint is required
  if (isTeacherSpecific && !teacherHint) {
    return Response.json(
      {
        ok: false,
        error: "Debes indicar el docente para una plancha de profesor específico",
      },
      { status: 400 }
    );
  }

  if (!["PLANCHA", "SOLUCIONARIO", "AMBOS"].includes(resourceKind)) {
    return Response.json({ ok: false, error: "resource_kind inválido" }, { status: 400 });
  }

  const { data: evaluation, error: evaluationError } = await supabaseAdmin
    .from("evaluation_type")
    .select("evaluation_id, evaluation_name, evaluation_abr")
    .eq("evaluation_id", evaluationId)
    .single();

  if (evaluationError || !evaluation) {
    return Response.json(
      {
        ok: false,
        error: "No se encontró la evaluación seleccionada",
      },
      { status: 404 }
    );
  }

  const examType = String(evaluation.evaluation_abr ?? "")
    .trim()
    .toUpperCase();

  if (!examType) {
    return Response.json(
      {
        ok: false,
        error: "La evaluación seleccionada no tiene abreviatura válida",
      },
      { status: 400 }
    );
  }

  // Resolve course
  const { data: course, error: courseError } = await supabaseAdmin
    .from("courses")
    .select("id, code")
    .eq("id", courseId)
    .single();

  if (courseError || !course) {
    return Response.json({ ok: false, error: "course_id no encontrado" }, { status: 404 });
  }

  const normalizedCode = String(course.code ?? "")
    .trim()
    .toUpperCase();

  if (!normalizedCode || normalizedCode !== courseCode) {
    return Response.json(
      {
        ok: false,
        error: "El course_id no coincide con el course_code enviado",
      },
      { status: 400 }
    );
  }

  // Si se quiere subir un SOLUCIONARIO, validar que la PLANCHA ya exista en la base de datos
  if (resourceKind === "SOLUCIONARIO") {
    let sheetQuery = supabaseAdmin
      .from("sheets")
      .select("id")
      .eq("course_id", courseId)
      .eq("cycle", cycle)
      .eq("evaluation_id", evaluationId);

    if (isTeacherSpecific && teacherHint) {
      sheetQuery = sheetQuery.eq("teacher_hint", teacherHint);
    } else {
      sheetQuery = sheetQuery.or("teacher_hint.is.null,teacher_hint.eq.todos los profesores,teacher_hint.eq.todos");
    }

    const { data: existingSheet, error: lookupError } = await sheetQuery.maybeSingle();

    if (lookupError) {
      console.error("Error al buscar plancha existente para solucionario:", lookupError);
      return Response.json(
        { ok: false, error: "Error al validar la existencia de la plancha" },
        { status: 500 }
      );
    }

    if (!existingSheet) {
      return Response.json(
        { ok: false, error: "Primero debes subir la plancha antes de adjuntar un solucionario" },
        { status: 400 }
      );
    }
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
        sError,
      );
      return Response.json(
        {
          ok: false,
          error: "No se pudo generar URLs de subida conjunta.",
        },
        { status: 500 }
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
      return Response.json(
        {
          ok: false,
          error: "No se pudo generar la URL de subida. ¿El archivo ya existe?",
        },
        { status: 500 }
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
        thumbError,
      );
      // Non-fatal, we can still upload the PDF even if thumb url fails
    }
  }

  return Response.json(
    {
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
    },
    { status: 200 }
  );
};
