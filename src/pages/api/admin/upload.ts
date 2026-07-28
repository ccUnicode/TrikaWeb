export const prerender = false;

import type { APIRoute } from "astro";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { validateAdminSession } from "../../../lib/adminAuth";

type ResourceKind = "PLANCHA" | "SOLUCIONARIO" | "AMBOS";

const RESOURCE_KINDS: ResourceKind[] = ["PLANCHA", "SOLUCIONARIO", "AMBOS"];

const isPositiveInteger = (value: number): boolean =>
  Number.isSafeInteger(value) && value > 0;

/**
 * POST /api/admin/upload
 *
 * Registra los metadatos de una plancha, solucionario o ambos
 * después de subir los archivos a Supabase Storage.
 *
 * El endpoint valida nuevamente todas las relaciones, aunque
 * upload-url ya las haya validado. Esto evita que se pueda llamar
 * directamente a este endpoint con datos manipulados.
 */
export const GET: APIRoute = () =>
  Response.json(
    {
      ok: true,
      route: "/api/admin/upload",
    },
    { status: 200 },
  );

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

  const storagePath = String(body.storage_path ?? "").trim();

  const solutionStoragePath = String(body.solution_storage_path ?? "").trim();

  const thumbStoragePath = String(body.thumb_storage_path ?? "").trim();

  const isTeacherSpecific = body.is_teacher_specific === true;

  if (
    !isPositiveInteger(courseId) ||
    !isPositiveInteger(evaluationId) ||
    !cycle ||
    !rawResourceKind ||
    !storagePath
  ) {
    return Response.json(
      {
        ok: false,
        error: "Faltan campos requeridos o son inválidos",
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

  if (resourceKind === "AMBOS" && !solutionStoragePath) {
    return Response.json(
      {
        ok: false,
        error:
          "Debes proporcionar la ruta del solucionario cuando seleccionas AMBOS",
      },
      { status: 400 },
    );
  }

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
     * Validar que el curso exista.
     */
    const { data: course, error: courseError } = await supabaseAdmin
      .from("courses")
      .select("id, code")
      .eq("id", courseId)
      .maybeSingle();

    if (courseError) {
      console.error("Error al validar el curso:", courseError);

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

    /*
     * Validar que la evaluación pertenezca al curso.
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
     * Obtener exam_type desde la base de datos.
     * Ya no se acepta como valor confiable desde el cliente.
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
     * Validar la asociación del profesor con el curso y obtener
     * el nombre directamente desde teachers.
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
     * Registrar el ciclo mediante upsert para evitar condiciones
     * de carrera entre dos solicitudes que intenten crearlo.
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
          error: "No se pudo registrar el ciclo",
        },
        { status: 500 },
      );
    }

    /*
     * Buscar una plancha existente utilizando el nombre validado
     * del profesor, nunca un texto recibido desde el navegador.
     */
    let lookupQuery = supabaseAdmin
      .from("sheets")
      .select("id")
      .eq("course_id", courseId)
      .eq("cycle", cycle)
      .eq("evaluation_id", evaluationId);

    if (isTeacherSpecific && teacherName) {
      lookupQuery = lookupQuery
        .eq("is_teacher_specific", true)
        .eq("teacher_hint", teacherName);
    } else {
      lookupQuery = lookupQuery
        .eq("is_teacher_specific", false)
        .or(
          "teacher_hint.is.null,teacher_hint.eq.todos los profesores,teacher_hint.eq.todos",
        );
    }

    const { data: existingSheet, error: lookupError } =
      await lookupQuery.maybeSingle();

    if (lookupError) {
      console.error("Error al buscar la plancha existente:", lookupError);

      return Response.json(
        {
          ok: false,
          error: "No se pudo validar la plancha",
        },
        { status: 500 },
      );
    }

    if (resourceKind === "PLANCHA" || resourceKind === "AMBOS") {
      const insertPayload: Record<string, unknown> = {
        course_id: courseId,
        cycle,
        evaluation_id: evaluationId,
        exam_type: examType,
        exam_storage_path: storagePath,
        teacher_hint: teacherName,
        thumb_storage_path: thumbStoragePath || null,
        is_hidden: false,
        is_teacher_specific: isTeacherSpecific,
      };

      if (resourceKind === "AMBOS") {
        insertPayload.solution_kind = "pdf";
        insertPayload.solution_storage_path = solutionStoragePath;
      }

      if (existingSheet) {
        const updatePayload: Record<string, unknown> = {
          evaluation_id: evaluationId,
          exam_type: examType,
          exam_storage_path: storagePath,
          teacher_hint: teacherName,
          is_teacher_specific: isTeacherSpecific,
        };

        if (thumbStoragePath) {
          updatePayload.thumb_storage_path = thumbStoragePath;
        }

        if (resourceKind === "AMBOS") {
          updatePayload.solution_kind = "pdf";
          updatePayload.solution_storage_path = solutionStoragePath;
        }

        const { error: updateError } = await supabaseAdmin
          .from("sheets")
          .update(updatePayload)
          .eq("id", existingSheet.id);

        if (updateError) {
          console.error("Error al actualizar sheet:", updateError);

          return Response.json(
            {
              ok: false,
              error:
                "El archivo se subió, pero no se pudo actualizar la plancha",
            },
            { status: 500 },
          );
        }
      } else {
        const { error: insertError } = await supabaseAdmin
          .from("sheets")
          .insert(insertPayload);

        if (insertError) {
          console.error("Error al insertar sheet:", insertError);

          return Response.json(
            {
              ok: false,
              error: "Archivo subido, pero falló el registro de la plancha",
            },
            { status: 500 },
          );
        }
      }
    } else {
      if (!existingSheet) {
        return Response.json(
          {
            ok: false,
            error: "Primero sube la plancha antes de adjuntar un solucionario",
          },
          { status: 400 },
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

        return Response.json(
          {
            ok: false,
            error: "Archivo subido, pero no se pudo registrar el solucionario",
          },
          { status: 500 },
        );
      }
    }

    const action =
      resourceKind === "AMBOS"
        ? "Plancha y solucionario"
        : resourceKind === "PLANCHA"
          ? "Plancha"
          : "Solucionario";

    return Response.json(
      {
        ok: true,
        message: `${action} guardado correctamente`,
        path: storagePath,
        teacherId: isTeacherSpecific ? teacherId : null,
        teacherName,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error inesperado en /api/admin/upload:", error);

    return Response.json(
      {
        ok: false,
        error: "Error interno del servidor",
      },
      { status: 500 },
    );
  }
};
