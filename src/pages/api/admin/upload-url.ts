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

type ResourceKind = "PLANCHA" | "SOLUCIONARIO" | "AMBOS";

export const POST: APIRoute = async ({ request, cookies }) => {
  // Validar sesión administrativa mediante cookie.
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

  // Interpretar el cuerpo JSON.
  let body: Record<string, unknown>;

  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json(
      {
        ok: false,
        error: "Body JSON inválido",
      },
      { status: 400 }
    );
  }

  const courseId = Number(body.course_id);
  const courseCode = String(body.course_code ?? "")
    .trim()
    .toUpperCase();
  const cycle = String(body.cycle ?? "")
    .trim()
    .toUpperCase();
  const evaluationId = Number(body.evaluation_id);
  const resourceKind = String(body.resource_kind ?? "")
    .trim()
    .toUpperCase() as ResourceKind;
  const teacherHint = String(body.teacher_hint ?? "").trim();
  const isTeacherSpecific = body.is_teacher_specific === true;

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

  // Validar resource_kind antes de realizar operaciones en la base de datos.
  if (!["PLANCHA", "SOLUCIONARIO", "AMBOS"].includes(resourceKind)) {
    return Response.json(
      {
        ok: false,
        error: "resource_kind inválido",
      },
      { status: 400 }
    );
  }

  // Si la plancha es específica de un profesor, teacher_hint es obligatorio.
  if (isTeacherSpecific && !teacherHint) {
    return Response.json(
      {
        ok: false,
        error:
          "Debes indicar el docente para una plancha de profesor específico",
      },
      { status: 400 }
    );
  }

  // Validar el formato del ciclo y obtener sus componentes.
  const cycleMatch = cycle.match(/^(\d{4})-(I|II|III)$/);

  if (!cycleMatch) {
    return Response.json(
      {
        ok: false,
        error:
          "Formato de ciclo inválido. Usa el formato 2026-I, 2026-II o 2026-III.",
      },
      { status: 400 }
    );
  }

  const cycleYear = Number(cycleMatch[1]);
  const cycleTerm = cycleMatch[2];

  // Registrar el ciclo si no existe y mantener completos sus campos obligatorios.
  const { error: cycleUpsertError } = await supabaseAdmin
    .from("cycles")
    .upsert(
      {
        cycle_code: cycle,
        year: cycleYear,
        term: cycleTerm,
      },
      {
        onConflict: "cycle_code",
      }
    );

  if (cycleUpsertError) {
    console.error("Error al registrar el ciclo:", cycleUpsertError);

    return Response.json(
      {
        ok: false,
        error: "No se pudo registrar el ciclo en la base de datos.",
      },
      { status: 500 }
    );
  }

  // Validar que la evaluación seleccionada exista.
  const { data: evaluation, error: evaluationError } = await supabaseAdmin
    .from("evaluation_type")
    .select("evaluation_id, evaluation_name, evaluation_abr")
    .eq("evaluation_id", evaluationId)
    .single();

  if (evaluationError || !evaluation) {
    if (evaluationError) {
      console.error(
        "Error al buscar la evaluación seleccionada:",
        evaluationError
      );
    }

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

  // Validar que el curso exista y coincida con el código recibido.
  const { data: course, error: courseError } = await supabaseAdmin
    .from("courses")
    .select("id, code")
    .eq("id", courseId)
    .single();

  if (courseError || !course) {
    if (courseError) {
      console.error("Error al buscar el curso:", courseError);
    }

    return Response.json(
      {
        ok: false,
        error: "course_id no encontrado",
      },
      { status: 404 }
    );
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

  /*
   * Para subir únicamente un solucionario, validar que la plancha
   * correspondiente ya exista.
   */
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
      sheetQuery = sheetQuery.or(
        "teacher_hint.is.null,teacher_hint.eq.todos los profesores,teacher_hint.eq.todos"
      );
    }

    const { data: existingSheet, error: lookupError } =
      await sheetQuery.maybeSingle();

    if (lookupError) {
      console.error(
        "Error al buscar la plancha existente para el solucionario:",
        lookupError
      );

      return Response.json(
        {
          ok: false,
          error: "Error al validar la existencia de la plancha",
        },
        { status: 500 }
      );
    }

    if (!existingSheet) {
      return Response.json(
        {
          ok: false,
          error:
            "Primero debes subir la plancha antes de adjuntar un solucionario",
        },
        { status: 400 }
      );
    }
  }

  /*
   * Construir la ruta del archivo.
   *
   * General:   BMA02/PC1/2024-II.pdf
   * Específica: BMA02/PC1/2024-II_Arambulo.pdf
   */
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
    // Generar URL firmada para la plancha.
    const { data: planchaData, error: planchaError } =
      await supabaseAdmin.storage
        .from("exams")
        .createSignedUploadUrl(path, { upsert: true });

    // Generar URL firmada para el solucionario.
    solutionPath = `${normalizedCode}/${safeExam}/${safeCycle}${safeTeacher}.pdf`;

    const { data: solutionData, error: solutionError } =
      await supabaseAdmin.storage
        .from("solutions")
        .createSignedUploadUrl(solutionPath, { upsert: true });

    if (
      planchaError ||
      !planchaData ||
      solutionError ||
      !solutionData
    ) {
      console.error(
        "Error al crear las URLs firmadas para AMBOS:",
        planchaError,
        solutionError
      );

      return Response.json(
        {
          ok: false,
          error: "No se pudieron generar las URLs de subida conjunta.",
        },
        { status: 500 }
      );
    }

    signedUrl = planchaData.signedUrl;
    token = planchaData.token;
    solutionSignedUrl = solutionData.signedUrl;
  } else {
    // Generar URL firmada para un único archivo.
    const { data: signedData, error: signedError } =
      await supabaseAdmin.storage
        .from(bucket)
        .createSignedUploadUrl(path, { upsert: true });

    if (signedError || !signedData) {
      console.error("Error al crear la URL firmada:", signedError);

      return Response.json(
        {
          ok: false,
          error: "No se pudo generar la URL de subida.",
        },
        { status: 500 }
      );
    }

    signedUrl = signedData.signedUrl;
    token = signedData.token;
  }

  // Generar opcionalmente una URL firmada para la miniatura.
  let thumbSignedUrl: string | undefined;
  let thumbPath: string | undefined;

  if (resourceKind === "PLANCHA" || resourceKind === "AMBOS") {
    thumbPath = `${normalizedCode}/${safeExam}/${safeCycle}${safeTeacher}.jpg`;

    const { data: thumbData, error: thumbError } =
      await supabaseAdmin.storage
        .from("thumbnails")
        .createSignedUploadUrl(thumbPath, { upsert: true });

    if (!thumbError && thumbData) {
      thumbSignedUrl = thumbData.signedUrl;
    } else {
      console.error(
        "Error al crear la URL firmada para la miniatura:",
        thumbError
      );
      // Este error no impide subir el PDF principal.
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