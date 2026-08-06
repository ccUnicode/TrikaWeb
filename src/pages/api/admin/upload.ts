export const prerender = false;

import type { APIRoute } from "astro";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { validateAdminSession } from "../../../lib/adminAuth";
import {
  buildFinalSheetStoragePaths,
  buildSheetStoragePaths,
  buildVersionedStoragePath,
  isValidUploadSessionId,
} from "../../../lib/adminUploadPaths";
import {
  promoteStorageObject,
  storageObjectExists,
} from "../../../lib/adminUploadStorage";

type ResourceKind = "PLANCHA" | "SOLUCIONARIO" | "AMBOS";

type StorageBucket = "exams" | "solutions" | "thumbnails";

interface StorageObjectReference {
  bucket: StorageBucket;
  path: string;
}

const RESOURCE_KINDS: ResourceKind[] = ["PLANCHA", "SOLUCIONARIO", "AMBOS"];

const isPositiveInteger = (value: number): boolean =>
  Number.isSafeInteger(value) && value > 0;

/**
 * Elimina objetos de Storage agrupándolos por bucket.
 *
 * La limpieza es compensatoria: Storage y PostgreSQL no comparten
 * una misma transacción, por lo que los archivos nuevos deben
 * eliminarse manualmente si falla una operación posterior.
 */
const removeStorageObjects = async (
  objects: StorageObjectReference[],
  context: string,
): Promise<void> => {
  const objectsByBucket = new Map<StorageBucket, Set<string>>();

  for (const object of objects) {
    if (!object.path) {
      continue;
    }

    const paths = objectsByBucket.get(object.bucket) ?? new Set<string>();

    paths.add(object.path);
    objectsByBucket.set(object.bucket, paths);
  }

  for (const [bucket, pathSet] of objectsByBucket) {
    const paths = [...pathSet];

    if (paths.length === 0) {
      continue;
    }

    const { error } = await supabaseAdmin.storage.from(bucket).remove(paths);

    if (error) {
      console.error(`Error al limpiar ${context} del bucket ${bucket}:`, {
        paths,
        error,
      });
    }
  }
};

/**
 * Registra el solucionario y reinicia las solicitudes de interés
 * dentro de una única transacción PostgreSQL.
 */
const registerSheetSolution = async (params: {
  sheetId: number;
  solutionStoragePath: string;
  examStoragePath?: string | null;
  thumbStoragePath?: string | null;
  evaluationId?: number | null;
  examType?: string | null;
  teacherId?: number | null;
  teacherName?: string | null;
  isTeacherSpecific?: boolean | null;
}): Promise<boolean> => {
  const { data: wasRegistered, error } = await supabaseAdmin.rpc(
    "register_sheet_solution",
    {
      p_sheet_id: params.sheetId,
      p_solution_storage_path: params.solutionStoragePath,
      p_exam_storage_path: params.examStoragePath ?? null,
      p_thumb_storage_path: params.thumbStoragePath ?? null,
      p_evaluation_id: params.evaluationId ?? null,
      p_exam_type: params.examType ?? null,
      p_teacher_id: params.teacherId ?? null,
      p_teacher_hint: params.teacherName ?? null,
      p_is_teacher_specific: params.isTeacherSpecific ?? null,
    },
  );

  if (error) {
    console.error(
      "Error al registrar el solucionario transaccionalmente:",
      error,
    );

    return false;
  }

  if (wasRegistered !== true) {
    console.error("register_sheet_solution no confirmó el registro:", {
      sheetId: params.sheetId,
      wasRegistered,
    });

    return false;
  }

  return true;
};

/**
 * POST /api/admin/upload
 *
 * Registra los metadatos de una plancha, un solucionario o ambos
 * después de subir los archivos a Supabase Storage.
 *
 * Para AMBOS:
 * - Los archivos se suben inicialmente a rutas temporales.
 * - Se comprueba que todos los objetos esperados existan.
 * - Se promueven a rutas finales versionadas.
 * - Se registra la operación en la base de datos.
 * - Si falla una promoción o el registro, se eliminan los objetos nuevos.
 */
export const GET: APIRoute = () =>
  Response.json(
    {
      ok: true,
      route: "/api/admin/upload",
    },
    {
      status: 200,
    },
  );

export const POST: APIRoute = async ({ request, cookies }) => {
  const isAdmin = await validateAdminSession(cookies);

  if (!isAdmin) {
    return Response.json(
      {
        ok: false,
        error: "No autorizado. Inicia sesión como admin.",
      },
      {
        status: 401,
      },
    );
  }

  let body: Record<string, unknown>;

  try {
    const parsedBody: unknown = await request.json();

    if (
      typeof parsedBody !== "object" ||
      parsedBody === null ||
      Array.isArray(parsedBody)
    ) {
      return Response.json(
        {
          ok: false,
          error: "Body JSON inválido",
        },
        {
          status: 400,
        },
      );
    }

    body = parsedBody as Record<string, unknown>;
  } catch {
    return Response.json(
      {
        ok: false,
        error: "Body JSON inválido",
      },
      {
        status: 400,
      },
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

  const uploadSessionId = String(body.upload_session_id ?? "").trim();

  const hasThumbUpload = body.has_thumb_upload === true;

  if (typeof body.is_teacher_specific !== "boolean") {
    return Response.json(
      {
        ok: false,
        error: "is_teacher_specific debe ser un valor booleano",
      },
      {
        status: 400,
      },
    );
  }

  const isTeacherSpecific = body.is_teacher_specific;

  if (
    !isPositiveInteger(courseId) ||
    !isPositiveInteger(evaluationId) ||
    !cycle ||
    !rawResourceKind
  ) {
    return Response.json(
      {
        ok: false,
        error: "Faltan campos requeridos o son inválidos",
      },
      {
        status: 400,
      },
    );
  }

  if (!RESOURCE_KINDS.includes(rawResourceKind as ResourceKind)) {
    return Response.json(
      {
        ok: false,
        error: "resource_kind inválido",
      },
      {
        status: 400,
      },
    );
  }

  const resourceKind = rawResourceKind as ResourceKind;

  if (resourceKind === "AMBOS" && !isValidUploadSessionId(uploadSessionId)) {
    return Response.json(
      {
        ok: false,
        error:
          "Debes proporcionar un upload_session_id válido cuando seleccionas AMBOS",
      },
      {
        status: 400,
      },
    );
  }

  if (isTeacherSpecific && !isPositiveInteger(teacherId)) {
    return Response.json(
      {
        ok: false,
        error:
          "Debes proporcionar un teacher_id válido para una plancha de profesor específico",
      },
      {
        status: 400,
      },
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
      {
        status: 400,
      },
    );
  }

  /*
   * Se establece únicamente para AMBOS.
   * Permite limpiar los archivos versionados ante una excepción
   * inesperada posterior a las promociones.
   */
  let cleanupOnUnexpectedFailure: (() => Promise<void>) | null = null;

  try {
    /*
     * Validar el curso.
     */
    const { data: course, error: courseError } = await supabaseAdmin
      .from("courses")
      .select("id, code, status")
      .eq("id", courseId)
      .maybeSingle();

    if (courseError) {
      console.error("Error al validar el curso:", courseError);

      return Response.json(
        {
          ok: false,
          error: "No se pudo validar el curso",
        },
        {
          status: 500,
        },
      );
    }

    if (!course) {
      return Response.json(
        {
          ok: false,
          error: "Curso no encontrado",
        },
        {
          status: 404,
        },
      );
    }

    const courseStatus = String(course.status ?? "")
      .trim()
      .toUpperCase();

    if (courseStatus !== "COMPLETO") {
      return Response.json(
        {
          ok: false,
          error:
            "Solo se puede registrar material para cursos con estado COMPLETO",
        },
        {
          status: 409,
        },
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
        {
          status: 400,
        },
      );
    }

    /*
     * Validar la relación curso-evaluación.
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
        {
          status: 500,
        },
      );
    }

    if (!courseEvaluation) {
      return Response.json(
        {
          ok: false,
          error: "La evaluación no pertenece al curso seleccionado",
        },
        {
          status: 400,
        },
      );
    }

    /*
     * Obtener la abreviatura oficial de la evaluación.
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
        {
          status: 500,
        },
      );
    }

    if (!evaluation) {
      return Response.json(
        {
          ok: false,
          error: "Evaluación no encontrada",
        },
        {
          status: 404,
        },
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
        {
          status: 400,
        },
      );
    }

    /*
     * Validar el profesor específico.
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
          {
            status: 500,
          },
        );
      }

      if (!courseTeacher) {
        return Response.json(
          {
            ok: false,
            error: "El profesor no está asociado al curso seleccionado",
          },
          {
            status: 400,
          },
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
          {
            status: 500,
          },
        );
      }

      if (!teacher) {
        return Response.json(
          {
            ok: false,
            error: "Profesor no encontrado",
          },
          {
            status: 404,
          },
        );
      }

      teacherName = String(teacher.full_name ?? "").trim();

      if (!teacherName) {
        return Response.json(
          {
            ok: false,
            error: "El profesor no tiene un nombre válido",
          },
          {
            status: 400,
          },
        );
      }
    }

    const resolvedTeacherId = isTeacherSpecific ? teacherId : null;

    /*
     * Registrar el ciclo.
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
        {
          status: 500,
        },
      );
    }

    /*
     * Buscar la plancha antes de realizar promociones.
     *
     * De este modo, un error de consulta no deja archivos
     * promocionados innecesariamente.
     */
    let lookupQuery = supabaseAdmin
      .from("sheets")
      .select("id")
      .eq("course_id", courseId)
      .eq("cycle", cycle)
      .eq("evaluation_id", evaluationId);

    if (isTeacherSpecific) {
      lookupQuery = lookupQuery
        .eq("is_teacher_specific", true)
        .eq("teacher_id", teacherId);
    } else {
      lookupQuery = lookupQuery
        .eq("is_teacher_specific", false)
        .is("teacher_id", null);
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
        {
          status: 500,
        },
      );
    }

    if (resourceKind === "SOLUCIONARIO" && !existingSheet) {
      return Response.json(
        {
          ok: false,
          error: "Primero sube la plancha antes de adjuntar un solucionario",
        },
        {
          status: 400,
        },
      );
    }

    /*
     * Calcular rutas confiables en el servidor.
     */
    const pathInput = {
      courseCode,
      cycle,
      examType,
      isTeacherSpecific,
      teacherId: resolvedTeacherId,
    };

    const baseFinalPaths = buildFinalSheetStoragePaths(pathInput);

    const stagingPaths =
      resourceKind === "AMBOS"
        ? buildSheetStoragePaths({
            ...pathInput,
            uploadSessionId,
          })
        : null;

    /*
     * AMBOS utiliza una versión nueva e inmutable.
     * PLANCHA y SOLUCIONARIO conservan el flujo existente
     * para mantener compatibilidad con upload-url.
     */
    const finalPaths =
      resourceKind === "AMBOS"
        ? {
            examPath: buildVersionedStoragePath(
              baseFinalPaths.examPath,
              uploadSessionId,
            ),
            solutionPath: buildVersionedStoragePath(
              baseFinalPaths.solutionPath,
              uploadSessionId,
            ),
            thumbPath: buildVersionedStoragePath(
              baseFinalPaths.thumbPath,
              uploadSessionId,
            ),
          }
        : baseFinalPaths;

    let examStoragePath: string | null = null;

    let solutionStoragePath: string | null = null;

    let thumbStoragePath: string | null = null;

    const promotedObjects: StorageObjectReference[] = [];

    const stagingObjects: StorageObjectReference[] =
      resourceKind === "AMBOS" && stagingPaths
        ? [
            {
              bucket: "exams",
              path: stagingPaths.examPath,
            },
            {
              bucket: "solutions",
              path: stagingPaths.solutionPath,
            },
            ...(hasThumbUpload
              ? [
                  {
                    bucket: "thumbnails" as const,
                    path: stagingPaths.thumbPath,
                  },
                ]
              : []),
          ]
        : [];

    const cleanupAmbosUpload = async (): Promise<void> => {
      await removeStorageObjects(promotedObjects, "objetos finales promovidos");

      await removeStorageObjects(stagingObjects, "objetos temporales");
    };

    if (resourceKind === "AMBOS" && stagingPaths) {
      cleanupOnUnexpectedFailure = cleanupAmbosUpload;

      /*
       * Verificar todos los objetos antes de iniciar
       * cualquier promoción.
       */
      const [stagingExamExists, stagingSolutionExists, stagingThumbExists] =
        await Promise.all([
          storageObjectExists("exams", stagingPaths.examPath),
          storageObjectExists("solutions", stagingPaths.solutionPath),
          hasThumbUpload
            ? storageObjectExists("thumbnails", stagingPaths.thumbPath)
            : Promise.resolve(true),
        ]);

      if (!stagingExamExists || !stagingSolutionExists || !stagingThumbExists) {
        await removeStorageObjects(
          stagingObjects,
          "objetos temporales incompletos",
        );

        cleanupOnUnexpectedFailure = null;

        return Response.json(
          {
            ok: false,
            error:
              "La subida conjunta está incompleta. Vuelve a subir los archivos.",
          },
          {
            status: 400,
          },
        );
      }

      /*
       * Registrar el destino antes de copiarlo.
       * Si la copia crea parcialmente el objeto y reporta error,
       * la limpieza también intentará eliminarlo.
       */
      promotedObjects.push({
        bucket: "exams",
        path: finalPaths.examPath,
      });

      const examPromoted = await promoteStorageObject(
        "exams",
        stagingPaths.examPath,
        finalPaths.examPath,
      );

      if (!examPromoted) {
        await cleanupAmbosUpload();
        cleanupOnUnexpectedFailure = null;

        return Response.json(
          {
            ok: false,
            error: "No se pudo finalizar la plancha subida",
          },
          {
            status: 500,
          },
        );
      }

      promotedObjects.push({
        bucket: "solutions",
        path: finalPaths.solutionPath,
      });

      const solutionPromoted = await promoteStorageObject(
        "solutions",
        stagingPaths.solutionPath,
        finalPaths.solutionPath,
      );

      if (!solutionPromoted) {
        await cleanupAmbosUpload();
        cleanupOnUnexpectedFailure = null;

        return Response.json(
          {
            ok: false,
            error: "No se pudo finalizar el solucionario subido",
          },
          {
            status: 500,
          },
        );
      }

      if (hasThumbUpload) {
        promotedObjects.push({
          bucket: "thumbnails",
          path: finalPaths.thumbPath,
        });

        const thumbPromoted = await promoteStorageObject(
          "thumbnails",
          stagingPaths.thumbPath,
          finalPaths.thumbPath,
        );

        if (!thumbPromoted) {
          await cleanupAmbosUpload();
          cleanupOnUnexpectedFailure = null;

          return Response.json(
            {
              ok: false,
              error: "No se pudo finalizar la miniatura subida",
            },
            {
              status: 500,
            },
          );
        }

        thumbStoragePath = finalPaths.thumbPath;
      }

      examStoragePath = finalPaths.examPath;

      solutionStoragePath = finalPaths.solutionPath;
    } else if (resourceKind === "PLANCHA") {
      const examExists = await storageObjectExists(
        "exams",
        finalPaths.examPath,
      );

      if (!examExists) {
        return Response.json(
          {
            ok: false,
            error: "No se encontró la plancha subida en Storage",
          },
          {
            status: 400,
          },
        );
      }

      examStoragePath = finalPaths.examPath;

      if (hasThumbUpload) {
        const thumbExists = await storageObjectExists(
          "thumbnails",
          finalPaths.thumbPath,
        );

        if (!thumbExists) {
          return Response.json(
            {
              ok: false,
              error: "No se encontró la miniatura subida en Storage",
            },
            {
              status: 400,
            },
          );
        }

        thumbStoragePath = finalPaths.thumbPath;
      }
    } else {
      const solutionExists = await storageObjectExists(
        "solutions",
        finalPaths.solutionPath,
      );

      if (!solutionExists) {
        return Response.json(
          {
            ok: false,
            error: "No se encontró el solucionario subido en Storage",
          },
          {
            status: 400,
          },
        );
      }

      solutionStoragePath = finalPaths.solutionPath;
    }

    /*
     * Registrar los metadatos.
     */
    if (resourceKind === "PLANCHA" || resourceKind === "AMBOS") {
      if (!examStoragePath) {
        if (resourceKind === "AMBOS") {
          await cleanupAmbosUpload();
          cleanupOnUnexpectedFailure = null;
        }

        return Response.json(
          {
            ok: false,
            error: "No se pudo determinar la ruta de la plancha",
          },
          {
            status: 500,
          },
        );
      }

      if (existingSheet) {
        const targetSheetId = Number(existingSheet.id);

        if (!Number.isSafeInteger(targetSheetId) || targetSheetId <= 0) {
          if (resourceKind === "AMBOS") {
            await cleanupAmbosUpload();
            cleanupOnUnexpectedFailure = null;
          }

          return Response.json(
            {
              ok: false,
              error: "No se pudo identificar la plancha",
            },
            {
              status: 500,
            },
          );
        }

        if (resourceKind === "AMBOS" && solutionStoragePath) {
          const registered = await registerSheetSolution({
            sheetId: targetSheetId,
            solutionStoragePath,
            examStoragePath,
            thumbStoragePath,
            evaluationId,
            examType,
            teacherId: resolvedTeacherId,
            teacherName,
            isTeacherSpecific,
          });

          if (!registered) {
            await cleanupAmbosUpload();
            cleanupOnUnexpectedFailure = null;

            return Response.json(
              {
                ok: false,
                error:
                  "Los archivos se subieron, pero no se pudo registrar la plancha y el solucionario",
              },
              {
                status: 500,
              },
            );
          }
        } else {
          const updatePayload: Record<string, unknown> = {
            evaluation_id: evaluationId,
            exam_type: examType,
            exam_storage_path: examStoragePath,
            thumb_storage_path: thumbStoragePath,
            teacher_id: resolvedTeacherId,
            teacher_hint: teacherName,
            is_teacher_specific: isTeacherSpecific,
          };

          const { error: updateError } = await supabaseAdmin
            .from("sheets")
            .update(updatePayload)
            .eq("id", targetSheetId);

          if (updateError) {
            console.error("Error al actualizar la plancha:", updateError);

            return Response.json(
              {
                ok: false,
                error:
                  "El archivo se subió, pero no se pudo actualizar la plancha",
              },
              {
                status: 500,
              },
            );
          }
        }
      } else {
        const insertPayload: Record<string, unknown> = {
          course_id: courseId,
          cycle,
          evaluation_id: evaluationId,
          exam_type: examType,
          exam_storage_path: examStoragePath,
          teacher_id: resolvedTeacherId,
          teacher_hint: teacherName,
          is_teacher_specific: isTeacherSpecific,
          thumb_storage_path: thumbStoragePath,
          is_hidden: false,
        };

        if (resourceKind === "AMBOS" && solutionStoragePath) {
          insertPayload.solution_kind = "pdf";

          insertPayload.solution_storage_path = solutionStoragePath;

          insertPayload.solution_video_url = null;
        }

        const { error: insertError } = await supabaseAdmin
          .from("sheets")
          .insert(insertPayload);

        if (insertError) {
          console.error("Error al insertar la plancha:", insertError);

          if (resourceKind === "AMBOS") {
            await cleanupAmbosUpload();
            cleanupOnUnexpectedFailure = null;
          }

          return Response.json(
            {
              ok: false,
              error:
                "Los archivos se subieron, pero falló el registro de la plancha",
            },
            {
              status: 500,
            },
          );
        }
      }
    } else {
      /*
       * SOLUCIONARIO siempre requiere una plancha existente.
       */
      if (!existingSheet || !solutionStoragePath) {
        return Response.json(
          {
            ok: false,
            error: "Primero sube la plancha antes de adjuntar un solucionario",
          },
          {
            status: 400,
          },
        );
      }

      const targetSheetId = Number(existingSheet.id);

      if (!Number.isSafeInteger(targetSheetId) || targetSheetId <= 0) {
        return Response.json(
          {
            ok: false,
            error: "No se pudo identificar la plancha",
          },
          {
            status: 500,
          },
        );
      }

      const registered = await registerSheetSolution({
        sheetId: targetSheetId,
        solutionStoragePath,
      });

      if (!registered) {
        return Response.json(
          {
            ok: false,
            error:
              "El archivo se subió, pero no se pudo registrar el solucionario",
          },
          {
            status: 500,
          },
        );
      }
    }

    /*
     * La base de datos ya referencia las rutas finales.
     * Desde este punto no debe eliminarse la versión promovida.
     */
    cleanupOnUnexpectedFailure = null;

    if (resourceKind === "AMBOS") {
      /*
       * La limpieza temporal no afecta la respuesta:
       * si falla, se registra el error para mantenimiento,
       * pero la operación final ya quedó consistente.
       */
      await removeStorageObjects(
        stagingObjects,
        "objetos temporales posteriores al registro",
      );
    }

    const action =
      resourceKind === "AMBOS"
        ? "Plancha y solucionario"
        : resourceKind === "PLANCHA"
          ? "Plancha"
          : "Solucionario";

    const registeredPath =
      resourceKind === "SOLUCIONARIO" ? solutionStoragePath : examStoragePath;

    return Response.json(
      {
        ok: true,
        message: `${action} guardado correctamente`,
        path: registeredPath,
        teacherId: resolvedTeacherId,
        teacherName,
      },
      {
        status: 200,
      },
    );
  } catch (error) {
    if (cleanupOnUnexpectedFailure) {
      await cleanupOnUnexpectedFailure();
    }

    console.error("Error inesperado en /api/admin/upload:", error);

    return Response.json(
      {
        ok: false,
        error: "Error interno del servidor",
      },
      {
        status: 500,
      },
    );
  }
};
