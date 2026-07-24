export const prerender = false;

import type { APIRoute } from "astro";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { validateAdminSession } from "../../../lib/adminAuth";

/**
 * POST /api/admin/upload
 * Registra los metadatos de una plancha/solucionario/ambos en la BD,
 * después de que el archivo ya fue subido a Storage.
 *
 * Flujo:
 * 1. Valida campos requeridos (course_id, evaluation_id, cycle, resource_kind, storage_path)
 * 2. Valida ciclo (formato AAAA-T) y lo crea si no existe
 * 3. Busca sheet existente por course_id + cycle + evaluation_id (+ teacher_hint si es específico)
 * 4. Hace upsert: actualiza si existe, inserta si no (PLANCHA/AMBOS) o actualiza SOLUCIONARIO
 * 5. Soporta resourceKind = "PLANCHA" | "SOLUCIONARIO" | "AMBOS"
 */

export const GET: APIRoute = () => {
  return Response.json({ ok: true, route: "/api/admin/upload" }, { status: 200 });
};

export const POST: APIRoute = async ({ request, cookies }) => {
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

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Body JSON inválido" }, { status: 400 });
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
  const thumbStoragePath = String(body.thumb_storage_path ?? "").trim();
  const isTeacherSpecific = Boolean(body.is_teacher_specific);

  if (
    !courseId ||
    Number.isNaN(courseId) ||
    !evaluationId ||
    Number.isNaN(evaluationId) ||
    !cycle ||
    !examType ||
    !resourceKind ||
    !storagePath
  ) {
    return Response.json({ ok: false, error: "Faltan campos requeridos" }, { status: 400 });
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

  // 1. Validar el formato del ciclo antes de interactuar con la BD
  const match = cycle.match(/^(\d{4})-(I|II|III)$/i);
  if (!match) {
    return Response.json(
      {
        ok: false,
        error: "Formato de ciclo inválido. Usa el formato 2026-I, 2026-II o 2026-III.",
      },
      { status: 400 }
    );
  }

  try {
    // Check existing sheet — include teacher_hint in the lookup so
    // professor-specific sheets don't collide with general ones.
    // For teacher-specific: match by teacher_hint
    // For general: match where teacher_hint IS NULL or generic values
    let lookupQuery = supabaseAdmin
      .from("sheets")
      .select("id")
      .eq("course_id", courseId)
      .eq("cycle", cycle)
      .eq("evaluation_id", evaluationId);

    if (isTeacherSpecific && teacherHint) {
      lookupQuery = lookupQuery.eq("teacher_hint", teacherHint);
    } else {
      // General sheet: look for one without a specific teacher
      lookupQuery = lookupQuery.or(
        "teacher_hint.is.null,teacher_hint.eq.todos los profesores,teacher_hint.eq.todos",
      );
    }

    const { data: cycleExists, error: cycleError } = await supabaseAdmin
      .from("cycles")
      .select("cycle_id")
      .eq("cycle_code", cycle)
      .maybeSingle();

    if (cycleError) {
      console.error("Error al validar ciclo:", cycleError);
      return Response.json({ ok: false, error: "Error validando ciclo" }, { status: 500 });
    }

    if (!cycleExists) {
      const year = parseInt(match[1], 10);
      const term = match[2].toUpperCase();

      const { error: insertError } = await supabaseAdmin
        .from("cycles")
        .insert([{ cycle_code: cycle, year, term }]);

      if (insertError) {
        console.error("Error insertando nuevo ciclo:", insertError);
        return Response.json({ ok: false, error: "Error creando nuevo ciclo" }, { status: 500 });
      }
    }

    const { data: existingSheet, error: lookupError } =
      await lookupQuery.maybeSingle();

    if (lookupError) {
      console.error("Error al buscar sheet existente:", lookupError);
      return Response.json({ ok: false, error: "No se pudo validar la plancha" }, { status: 500 });
    }

    if (resourceKind === "PLANCHA" || resourceKind === "AMBOS") {
      const insertPayload: Record<string, unknown> = {
        course_id: courseId,
        cycle,
        evaluation_id: evaluationId,
        exam_type: examType,
        exam_storage_path: storagePath,
        teacher_hint: teacherHint || null,
        thumb_storage_path: thumbStoragePath || null,
        is_hidden: false,
        is_teacher_specific: isTeacherSpecific,
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
          is_teacher_specific: isTeacherSpecific,
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
          return Response.json(
            {
              ok: false,
              error: "El archivo se subió, pero no se pudo actualizar la plancha",
            },
            { status: 500 }
          );
        }
      } else {
        const { error: insertError } = await supabaseAdmin
          .from("sheets")
          .insert([insertPayload]);

        if (insertError) {
          console.error("Error al insertar sheet:", insertError);
          return Response.json(
            {
              ok: false,
              error: "Archivo subido, pero falló el registro de la plancha",
            },
            { status: 500 }
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
          { status: 400 }
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
          { status: 500 }
        );
      }
    }

    const action =
      resourceKind === "AMBOS"
        ? "Plancha y Solucionario"
        : resourceKind === "PLANCHA"
          ? "Plancha"
          : "Solucionario";

    return Response.json(
      {
        ok: true,
        message: `${action} guardado correctamente`,
        path: storagePath,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("Error inesperado en /api/admin/upload:", err);
    return Response.json(
      { ok: false, error: "Error interno en el servidor" },
      { status: 500 }
    );
  }
};
