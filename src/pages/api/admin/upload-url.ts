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
 * - El nombre y código utilizados se obtienen desde la base de datos.
 * - Para SOLUCIONARIO debe existir previamente la plancha correspondiente.
 * - Las planchas específicas se identifican mediante sheets.teacher_id.
 *
 * Estrategia de rutas:
 * - PLANCHA y SOLUCIONARIO suben directamente a su ruta final.
 * - AMBOS sube primero a rutas temporales asociadas a uploadSessionId.
 * - upload.ts promueve después los archivos a rutas finales versionadas.
 */

export const prerender = false;

import type { APIRoute } from "astro";
import { randomUUID } from "node:crypto";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { validateAdminSession } from "../../../lib/adminAuth";
import {
  buildFinalSheetStoragePaths,
  buildSheetStoragePaths,
  buildVersionedStoragePath,
  isValidUploadSessionId,
} from "../../../lib/adminUploadPaths";

type ResourceKind = "PLANCHA" | "SOLUCIONARIO" | "AMBOS";

const RESOURCE_KINDS: ResourceKind[] = ["PLANCHA", "SOLUCIONARIO", "AMBOS"];

/**
 * Valida que un valor sea un identificador entero positivo.
 */
const isPositiveInteger = (value: number): boolean =>
  Number.isSafeInteger(value) && value > 0;

/**
 * Genera una URL firmada para que el navegador suba PDFs directamente
 * a Supabase Storage, evitando el límite de 4.5 MB del body en Vercel.
 * La ruta de almacenamiento se construye como: {courseCode}/{examType}/{cycle}.pdf
 */
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
        error: "Faltan campos obligatorios o son inválidos",
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

  try {
    /*
     * Obtener el curso desde la base de datos.
     * El código no se acepta como fuente confiable del cliente.
     */
    const { data: course, error: courseError } = await supabaseAdmin
      .from("courses")
      .select("id, code, status")
      .eq("id", courseId)
      .maybeSingle();

    if (courseError) {
      console.error("Error al buscar el curso:", courseError);

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
          error: "Solo se puede subir material a cursos con estado COMPLETO",
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
     * Validar que la evaluación esté habilitada para el curso.
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
     * Para una plancha específica se valida courses_teachers.
     * teacher_id se usa como identidad estable.
     * teacherName se conserva únicamente para presentación.
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
     * Registrar el ciclo después de validar las relaciones.
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
        {
          status: 500,
        },
      );
    }

    /*
     * Para SOLUCIONARIO se valida que exista previamente
     * la plancha correspondiente.
     */
    let targetSheetId: number | null = null;

    if (resourceKind === "SOLUCIONARIO") {
      let sheetQuery = supabaseAdmin
        .from("sheets")
        .select("id")
        .eq("course_id", courseId)
        .eq("cycle", cycle)
        .eq("evaluation_id", evaluationId);

      if (isTeacherSpecific) {
        sheetQuery = sheetQuery
          .eq("is_teacher_specific", true)
          .eq("teacher_id", teacherId);
      } else {
        sheetQuery = sheetQuery
          .eq("is_teacher_specific", false)
          .is("teacher_id", null);
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
          {
            status: 500,
          },
        );
      }

      if (!existingSheet) {
        return Response.json(
          {
            ok: false,
            error:
              "Primero debes subir la plancha antes de adjuntar un solucionario",
          },
          {
            status: 400,
          },
        );
      }

      targetSheetId = Number(existingSheet.id);

      if (!Number.isSafeInteger(targetSheetId) || targetSheetId <= 0) {
        console.error(
          "La plancha encontrada tiene un ID inválido:",
          existingSheet.id,
        );

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
    }

    /*
     * Las rutas se calculan exclusivamente en el servidor.
     */
    const pathInput = {
      courseCode,
      cycle,
      examType,
      isTeacherSpecific,
      teacherId: resolvedTeacherId,
    };

    const baseFinalPaths = buildFinalSheetStoragePaths(pathInput);

    let uploadSessionId: string | null = null;

    if (resourceKind === "AMBOS") {
      uploadSessionId = randomUUID();

      /*
       * Aunque randomUUID devuelve un UUID válido, se comprueba
       * con la misma función utilizada posteriormente por upload.ts.
       */
      if (!isValidUploadSessionId(uploadSessionId)) {
        console.error("No se pudo generar un upload_session_id válido.");

        return Response.json(
          {
            ok: false,
            error: "No se pudo inicializar la subida conjunta",
          },
          {
            status: 500,
          },
        );
      }
    }

    /*
     * AMBOS sube a staging.
     * Las cargas individuales suben directamente a su ruta final.
     */
    const uploadPaths =
      uploadSessionId !== null
        ? buildSheetStoragePaths({
            ...pathInput,
            uploadSessionId,
          })
        : baseFinalPaths;

    /*
     * Estas rutas deben coincidir exactamente con las calculadas
     * por upload.ts después de recibir uploadSessionId.
     */
    const registeredFinalPaths =
      uploadSessionId !== null
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

    /*
     * Para una carga individual se firma la ruta que corresponde
     * al tipo de recurso. SOLUCIONARIO debe usar solutionPath.
     */
    const primaryUploadPath =
      resourceKind === "SOLUCIONARIO"
        ? uploadPaths.solutionPath
        : uploadPaths.examPath;

    const primaryBucket =
      resourceKind === "SOLUCIONARIO" ? "solutions" : "exams";

    let signedUrl: string | undefined;
    let token: string | undefined;

    let solutionSignedUrl: string | undefined;
    let solutionToken: string | undefined;

    if (resourceKind === "AMBOS") {
      const { data: planchaData, error: planchaError } =
        await supabaseAdmin.storage
          .from("exams")
          .createSignedUploadUrl(uploadPaths.examPath, {
            /*
             * El UUID hace que la ruta temporal sea única.
             * No debe sobrescribirse una sesión previa.
             */
            upsert: false,
          });

      const { data: solutionData, error: solutionError } =
        await supabaseAdmin.storage
          .from("solutions")
          .createSignedUploadUrl(uploadPaths.solutionPath, {
            upsert: false,
          });

      if (planchaError || !planchaData || solutionError || !solutionData) {
        console.error("Error al crear las URLs firmadas:", {
          planchaError,
          solutionError,
        });

        return Response.json(
          {
            ok: false,
            error: "No se pudieron generar las URLs de subida conjunta",
          },
          {
            status: 500,
          },
        );
      }

      signedUrl = planchaData.signedUrl;
      token = planchaData.token;

      solutionSignedUrl = solutionData.signedUrl;
      solutionToken = solutionData.token;
    } else {
      const { data: signedData, error: signedError } =
        await supabaseAdmin.storage
          .from(primaryBucket)
          .createSignedUploadUrl(primaryUploadPath, {
            /*
             * Las cargas individuales conservan el comportamiento
             * de reemplazo de la ruta final.
             */
            upsert: true,
          });

      if (signedError || !signedData) {
        console.error("Error al crear la URL firmada:", signedError);

        return Response.json(
          {
            ok: false,
            error: "No se pudo generar la URL de subida",
          },
          {
            status: 500,
          },
        );
      }

      signedUrl = signedData.signedUrl;
      token = signedData.token;
    }

    /*
     * La miniatura se genera para PLANCHA y AMBOS.
     *
     * En AMBOS se usa la ruta temporal de la misma sesión.
     * En PLANCHA se utiliza directamente la ruta final.
     */
    let thumbSignedUrl: string | undefined;

    if (resourceKind === "PLANCHA" || resourceKind === "AMBOS") {
      const { data: thumbData, error: thumbError } = await supabaseAdmin.storage
        .from("thumbnails")
        .createSignedUploadUrl(uploadPaths.thumbPath, {
          upsert: resourceKind !== "AMBOS",
        });

      if (!thumbError && thumbData) {
        thumbSignedUrl = thumbData.signedUrl;
      } else {
        /*
         * La miniatura es opcional.
         * El frontend debe enviar has_thumb_upload=false si
         * no consiguió subirla.
         */
        console.error(
          "Error al crear la URL firmada de miniatura:",
          thumbError,
        );
      }
    }

    const solutionUploadPath =
      resourceKind === "PLANCHA" ? undefined : uploadPaths.solutionPath;

    return Response.json(
      {
        ok: true,

        /*
         * Datos de la carga principal.
         */
        signedUrl,
        token,
        path: primaryUploadPath,
        bucket: primaryBucket,

        /*
         * AMBOS debe enviar este valor posteriormente a upload.ts.
         */
        uploadSessionId,

        courseId,
        evaluationId,
        examType,
        targetSheetId,

        isTeacherSpecific,
        teacherId: resolvedTeacherId,
        teacherName,

        /*
         * Miniatura.
         */
        thumbSignedUrl,
        thumbPath:
          resourceKind === "PLANCHA" || resourceKind === "AMBOS"
            ? uploadPaths.thumbPath
            : undefined,

        /*
         * Segunda subida de AMBOS.
         */
        solutionSignedUrl,
        solutionToken,
        solutionPath: solutionUploadPath,

        /*
         * Rutas que upload.ts registrará si la operación termina.
         * No deben enviarse de vuelta como fuente confiable;
         * upload.ts las recalcula.
         */
        finalExamPath: registeredFinalPaths.examPath,
        finalSolutionPath: registeredFinalPaths.solutionPath,
        finalThumbPath: registeredFinalPaths.thumbPath,
      },
      {
        status: 200,
      },
    );
  } catch (error) {
    console.error("Error inesperado en /api/admin/upload-url:", error);

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
