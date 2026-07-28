/**
 * POST /api/admin/upload-url
 *
 * Genera URLs firmadas para subir PDFs directamente a Supabase Storage.
 *
 * Validaciones:
 * - La sesión debe pertenecer a un administrador.
 * - El curso debe existir.
 * - La evaluación debe estar asociada al curso.
 * - Para recursos específicos, el profesor debe estar asociado al curso.
 * - El nombre y código utilizados en las rutas se obtienen desde la BD.
 * - Para SOLUCIONARIO debe existir previamente la plancha correspondiente.
 */

export const prerender = false;

import type { APIRoute } from "astro";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { validateAdminSession } from "../../../lib/adminAuth";

type ResourceKind = "PLANCHA" | "SOLUCIONARIO" | "AMBOS";

const RESOURCE_KINDS: ResourceKind[] = ["PLANCHA", "SOLUCIONARIO", "AMBOS"];

/**
 * Convierte un texto en un segmento seguro para una ruta de Storage.
 */
const sanitizePathSegment = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");

/**
 * Valida que un valor sea un identificador entero positivo.
 */
const isPositiveInteger = (value: number): boolean =>
  Number.isSafeInteger(value) && value > 0;

export const POST: APIRoute = async ({ request, cookies }) => {
  const isAdmin = await validateAdminSession(cookies);

  if (!isAdmin) {
    return Response.json(
      {
        ok: false,
        error: "No autorizado. Inicia sesión como admin.",
      },
      { status: 401 },
    );
  }

  let body: Record<string, unknown>;

  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json(
      {
        ok: false,
        error: "Body JSON inválido",
      },
      { status: 400 },
    );
  }

  const courseId = Number(body.course_id);
  const evaluationId = Number(body.evaluation_id);
  const teacherId = Number(body.teacher_id);

  const cycle = String(body.cycle ?? "")
    .trim()
    .toUpperCase();

  const rawResourceKind = String(body.resource_kind ?? "")
    .trim()
    .toUpperCase();

  const isTeacherSpecific = body.is_teacher_specific === true;

  if (
    !isPositiveInteger(courseId) ||
    !isPositiveInteger(evaluationId) ||
    !cycle ||
    !rawResourceKind
  ) {
    return Response.json(
      {
        ok: false,
        error: "Faltan campos obligatorios o son inválidos",
      },
      { status: 400 },
    );
  }

  if (!RESOURCE_KINDS.includes(rawResourceKind as ResourceKind)) {
    return Response.json(
      {
        ok: false,
        error: "resource_kind inválido",
      },
      { status: 400 },
    );
  }

  const resourceKind = rawResourceKind as ResourceKind;

  if (isTeacherSpecific && !isPositiveInteger(teacherId)) {
    return Response.json(
      {
        ok: false,
        error:
          "Debes proporcionar un teacher_id válido para una plancha de profesor específico",
      },
      { status: 400 },
    );
  }

  const cycleMatch = cycle.match(/^(\d{4})-(I|II|III)$/);

  if (!cycleMatch) {
    return Response.json(
      {
        ok: false,
        error:
          "Formato de ciclo inválido. Usa el formato 2026-I, 2026-II o 2026-III.",
      },
      { status: 400 },
    );
  }

  try {
    /*
     * Obtener el curso desde la base de datos.
     * El código ya no se acepta como una fuente confiable del cliente.
     */
    const { data: course, error: courseError } = await supabaseAdmin
      .from("courses")
      .select("id, code")
      .eq("id", courseId)
      .maybeSingle();

    if (courseError) {
      console.error("Error al buscar el curso:", courseError);

      return Response.json(
        {
          ok: false,
          error: "No se pudo validar el curso",
        },
        { status: 500 },
      );
    }

    if (!course) {
      return Response.json(
        {
          ok: false,
          error: "Curso no encontrado",
        },
        { status: 404 },
      );
    }

    const courseCode = String(course.code ?? "")
      .trim()
      .toUpperCase();

    if (!courseCode) {
      return Response.json(
        {
          ok: false,
          error: "El curso no tiene un código válido",
        },
        { status: 400 },
      );
    }

    /*
     * Validar explícitamente que la evaluación esté habilitada
     * para el curso seleccionado.
     */
    const { data: courseEvaluation, error: courseEvaluationError } =
      await supabaseAdmin
        .from("course_evaluations")
        .select("course_id, evaluation_id")
        .eq("course_id", courseId)
        .eq("evaluation_id", evaluationId)
        .maybeSingle();

    if (courseEvaluationError) {
      console.error(
        "Error al validar la relación curso-evaluación:",
        courseEvaluationError,
      );

      return Response.json(
        {
          ok: false,
          error: "No se pudo validar la evaluación del curso",
        },
        { status: 500 },
      );
    }

    if (!courseEvaluation) {
      return Response.json(
        {
          ok: false,
          error: "La evaluación no pertenece al curso seleccionado",
        },
        { status: 400 },
      );
    }

    /*
     * Obtener los datos de la evaluación después de comprobar
     * su asociación con el curso.
     */
    const { data: evaluation, error: evaluationError } = await supabaseAdmin
      .from("evaluation_type")
      .select("evaluation_id, evaluation_name, evaluation_abr")
      .eq("evaluation_id", evaluationId)
      .maybeSingle();

    if (evaluationError) {
      console.error("Error al obtener la evaluación:", evaluationError);

      return Response.json(
        {
          ok: false,
          error: "No se pudo obtener la evaluación",
        },
        { status: 500 },
      );
    }

    if (!evaluation) {
      return Response.json(
        {
          ok: false,
          error: "Evaluación no encontrada",
        },
        { status: 404 },
      );
    }

    const examType = String(evaluation.evaluation_abr ?? "")
      .trim()
      .toUpperCase();

    if (!examType) {
      return Response.json(
        {
          ok: false,
          error: "La evaluación seleccionada no tiene una abreviatura válida",
        },
        { status: 400 },
      );
    }

    /*
     * Para una plancha específica se valida courses_teachers.
     * El nombre del profesor nunca se toma del cuerpo de la petición.
     */
    let teacherName: string | null = null;

    if (isTeacherSpecific) {
      const { data: courseTeacher, error: courseTeacherError } =
        await supabaseAdmin
          .from("courses_teachers")
          .select("course_id, teacher_id")
          .eq("course_id", courseId)
          .eq("teacher_id", teacherId)
          .maybeSingle();

      if (courseTeacherError) {
        console.error(
          "Error al validar la relación curso-profesor:",
          courseTeacherError,
        );

        return Response.json(
          {
            ok: false,
            error: "No se pudo validar el profesor del curso",
          },
          { status: 500 },
        );
      }

      if (!courseTeacher) {
        return Response.json(
          {
            ok: false,
            error: "El profesor no está asociado al curso seleccionado",
          },
          { status: 400 },
        );
      }

      const { data: teacher, error: teacherError } = await supabaseAdmin
        .from("teachers")
        .select("id, full_name")
        .eq("id", teacherId)
        .maybeSingle();

      if (teacherError) {
        console.error("Error al obtener el profesor:", teacherError);

        return Response.json(
          {
            ok: false,
            error: "No se pudo obtener el profesor",
          },
          { status: 500 },
        );
      }

      if (!teacher) {
        return Response.json(
          {
            ok: false,
            error: "Profesor no encontrado",
          },
          { status: 404 },
        );
      }

      teacherName = String(teacher.full_name ?? "").trim();

      if (!teacherName) {
        return Response.json(
          {
            ok: false,
            error: "El profesor no tiene un nombre válido",
          },
          { status: 400 },
        );
      }
    }

    /*
     * Registrar el ciclo después de validar curso, evaluación
     * y profesor.
     */
    const cycleYear = Number(cycleMatch[1]);
    const cycleTerm = cycleMatch[2];

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
        },
      );

    if (cycleUpsertError) {
      console.error("Error al registrar el ciclo:", cycleUpsertError);

      return Response.json(
        {
          ok: false,
          error: "No se pudo registrar el ciclo en la base de datos",
        },
        { status: 500 },
      );
    }

    /*
     * Para SOLUCIONARIO, comprobar que la plancha correspondiente
     * ya exista.
     */
    if (resourceKind === "SOLUCIONARIO") {
      let sheetQuery = supabaseAdmin
        .from("sheets")
        .select("id")
        .eq("course_id", courseId)
        .eq("cycle", cycle)
        .eq("evaluation_id", evaluationId);

      if (isTeacherSpecific && teacherName) {
        sheetQuery = sheetQuery
          .eq("is_teacher_specific", true)
          .eq("teacher_hint", teacherName);
      } else {
        sheetQuery = sheetQuery
          .eq("is_teacher_specific", false)
          .or(
            "teacher_hint.is.null,teacher_hint.eq.todos los profesores,teacher_hint.eq.todos",
          );
      }

      const { data: existingSheet, error: lookupError } =
        await sheetQuery.maybeSingle();

      if (lookupError) {
        console.error("Error al buscar la plancha existente:", lookupError);

        return Response.json(
          {
            ok: false,
            error: "Error al validar la existencia de la plancha",
          },
          { status: 500 },
        );
      }

      if (!existingSheet) {
        return Response.json(
          {
            ok: false,
            error:
              "Primero debes subir la plancha antes de adjuntar un solucionario",
          },
          { status: 400 },
        );
      }
    }

    /*
     * Construir las rutas usando únicamente datos validados
     * y obtenidos desde la base de datos.
     */
    const safeCourse = sanitizePathSegment(courseCode);
    const safeCycle = sanitizePathSegment(cycle);
    const safeExam = sanitizePathSegment(examType);
    const safeTeacher = teacherName
      ? `_${sanitizePathSegment(teacherName)}`
      : "";

    const path =
      `${safeCourse}/${safeExam}/` + `${safeCycle}${safeTeacher}.pdf`;

    const bucket = resourceKind === "SOLUCIONARIO" ? "solutions" : "exams";

    let signedUrl: string | undefined;
    let token: string | undefined;

    let solutionSignedUrl: string | undefined;
    let solutionToken: string | undefined;
    let solutionPath: string | undefined;

    if (resourceKind === "AMBOS") {
      const { data: planchaData, error: planchaError } =
        await supabaseAdmin.storage.from("exams").createSignedUploadUrl(path, {
          upsert: true,
        });

      solutionPath = path;

      const { data: solutionData, error: solutionError } =
        await supabaseAdmin.storage
          .from("solutions")
          .createSignedUploadUrl(solutionPath, {
            upsert: true,
          });

      if (planchaError || !planchaData || solutionError || !solutionData) {
        console.error(
          "Error al crear las URLs firmadas:",
          planchaError,
          solutionError,
        );

        return Response.json(
          {
            ok: false,
            error: "No se pudieron generar las URLs de subida conjunta",
          },
          { status: 500 },
        );
      }

      signedUrl = planchaData.signedUrl;
      token = planchaData.token;

      solutionSignedUrl = solutionData.signedUrl;
      solutionToken = solutionData.token;
    } else {
      const { data: signedData, error: signedError } =
        await supabaseAdmin.storage.from(bucket).createSignedUploadUrl(path, {
          upsert: true,
        });

      if (signedError || !signedData) {
        console.error("Error al crear la URL firmada:", signedError);

        return Response.json(
          {
            ok: false,
            error: "No se pudo generar la URL de subida",
          },
          { status: 500 },
        );
      }

      signedUrl = signedData.signedUrl;
      token = signedData.token;
    }

    let thumbSignedUrl: string | undefined;
    let thumbPath: string | undefined;

    if (resourceKind === "PLANCHA" || resourceKind === "AMBOS") {
      thumbPath =
        `${safeCourse}/${safeExam}/` + `${safeCycle}${safeTeacher}.jpg`;

      const { data: thumbData, error: thumbError } = await supabaseAdmin.storage
        .from("thumbnails")
        .createSignedUploadUrl(thumbPath, {
          upsert: true,
        });

      if (!thumbError && thumbData) {
        thumbSignedUrl = thumbData.signedUrl;
      } else {
        console.error("Error al crear la URL de miniatura:", thumbError);
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
        evaluationId,
        examType,

        isTeacherSpecific,
        teacherId: isTeacherSpecific ? teacherId : null,
        teacherName,

        thumbSignedUrl,
        thumbPath,

        solutionSignedUrl,
        solutionToken,
        solutionPath,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error inesperado en /api/admin/upload-url:", error);

    return Response.json(
      {
        ok: false,
        error: "Error interno del servidor",
      },
      { status: 500 },
    );
  }
};
