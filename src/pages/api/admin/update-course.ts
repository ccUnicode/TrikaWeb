export const prerender = false;

import type { APIRoute } from "astro";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { validateAdminSession } from "../../../lib/adminAuth";

type EvaluationIdsResult =
  | {
      valid: true;
      values: number[];
    }
  | {
      valid: false;
      error: string;
    };

const normalizeCode = (value: unknown): string =>
  String(value ?? "")
    .trim()
    .toUpperCase();

const normalizeName = (value: unknown): string => String(value ?? "").trim();

const normalizeSummary = (value: unknown): string | null => {
  const normalizedValue = String(value ?? "").trim();

  return normalizedValue || null;
};

const normalizeCredits = (value: unknown): number => {
  const normalizedValue = Number(value);

  return Number.isInteger(normalizedValue) ? normalizedValue : Number.NaN;
};

const normalizeRequiredId = (value: unknown): number | null => {
  const normalizedValue = Number(value);

  if (!Number.isSafeInteger(normalizedValue) || normalizedValue <= 0) {
    return null;
  }

  return normalizedValue;
};

const normalizeOptionalId = (
  value: unknown,
): {
  value: number | null;
  valid: boolean;
} => {
  if (value === undefined || value === null || value === "") {
    return {
      value: null,
      valid: true,
    };
  }

  const normalizedValue = normalizeRequiredId(value);

  return {
    value: normalizedValue,
    valid: normalizedValue !== null,
  };
};

/**
 * Valida el arreglo original de evaluaciones.
 *
 * No convierte cadenas a números ni elimina silenciosamente
 * IDs inválidos o repetidos.
 */
const validateEvaluationIds = (value: unknown): EvaluationIdsResult => {
  if (value === undefined) {
    return {
      valid: true,
      values: [],
    };
  }

  if (!Array.isArray(value)) {
    return {
      valid: false,
      error: "Las evaluaciones seleccionadas deben enviarse como una lista",
    };
  }

  const hasInvalidValue = value.some(
    (evaluationId: unknown) =>
      typeof evaluationId !== "number" ||
      !Number.isSafeInteger(evaluationId) ||
      evaluationId <= 0,
  );

  if (hasInvalidValue) {
    return {
      valid: false,
      error: "Las evaluaciones seleccionadas contienen IDs inválidos",
    };
  }

  const evaluationIds = value as number[];

  if (new Set<number>(evaluationIds).size !== evaluationIds.length) {
    return {
      valid: false,
      error: "Las evaluaciones seleccionadas no pueden contener IDs repetidos",
    };
  }

  return {
    valid: true,
    values: evaluationIds,
  };
};

const jsonError = (error: string, status: number): Response =>
  Response.json(
    {
      ok: false,
      error,
    },
    {
      status,
    },
  );

/**
 * PATCH /api/admin/update-course
 *
 * Actualiza un curso existente junto con su sistema,
 * subsistema y evaluaciones asociadas.
 *
 * La modificación se delega a la RPC
 * update_course_with_evaluations.
 */
export const PATCH: APIRoute = async ({ request, cookies }) => {
  try {
    const isValid = await validateAdminSession(cookies);

    if (!isValid) {
      return jsonError("Sesión inválida", 401);
    }

    let body: Record<string, unknown>;

    try {
      const parsedBody: unknown = await request.json();

      if (
        !parsedBody ||
        typeof parsedBody !== "object" ||
        Array.isArray(parsedBody)
      ) {
        return jsonError("Body JSON inválido", 400);
      }

      body = parsedBody as Record<string, unknown>;
    } catch {
      return jsonError("Body JSON inválido", 400);
    }

    const courseId = normalizeRequiredId(body.course_id);

    const code = normalizeCode(body.code);
    const name = normalizeName(body.name);
    const summary = normalizeSummary(body.summary);
    const credits = normalizeCredits(body.credits);

    const systemId = normalizeRequiredId(body.system_id);

    const normalizedSubsystem = normalizeOptionalId(body.subsystem_id);

    const subsystemId = normalizedSubsystem.value;

    /*
     * Validar el arreglo original antes de modificarlo.
     * Cualquier ID inválido o repetido produce una respuesta 400.
     */
    const evaluationIdsResult = validateEvaluationIds(
      body.selected_evaluations,
    );

    if (!evaluationIdsResult.valid) {
      return jsonError(evaluationIdsResult.error, 400);
    }

    const selectedEvaluations = evaluationIdsResult.values;

    if (courseId === null) {
      return jsonError("Curso inválido", 400);
    }

    if (!code || code.length < 2) {
      return jsonError("El código es requerido (mínimo 2 caracteres)", 400);
    }

    if (!name || name.length < 2) {
      return jsonError("El nombre es requerido (mínimo 2 caracteres)", 400);
    }

    if (summary !== null && summary.length > 1000) {
      return jsonError("La sumilla no puede superar los 1000 caracteres", 400);
    }

    if (!Number.isInteger(credits) || credits <= 0) {
      return jsonError(
        "Los créditos deben ser un número entero mayor a 0",
        400,
      );
    }

    if (systemId === null) {
      return jsonError("Debe seleccionar un sistema de evaluación válido", 400);
    }

    if (!normalizedSubsystem.valid) {
      return jsonError("Subsistema inválido", 400);
    }

    if (subsystemId === null && selectedEvaluations.length > 0) {
      return jsonError(
        "No se pueden seleccionar evaluaciones sin un subsistema de evaluación",
        400,
      );
    }

    const { data: result, error: rpcError } = await supabaseAdmin.rpc(
      "update_course_with_evaluations",
      {
        p_course_id: courseId,
        p_code: code,
        p_name: name,
        p_summary: summary,
        p_credits: credits,
        p_system_id: systemId,
        p_subsystem_id: subsystemId,
        p_selected_evaluations: selectedEvaluations,
      },
    );

    if (rpcError) {
      console.error("Error calling update_course_with_evaluations:", rpcError);

      return jsonError("Error al actualizar el curso", 500);
    }

    if (!result?.ok) {
      return jsonError(result?.error || "No se pudo actualizar el curso", 400);
    }

    return Response.json(
      {
        ok: true,
        course: result.course,
      },
      {
        status: 200,
      },
    );
  } catch (error) {
    console.error("update-course API error:", error);

    return jsonError("Error interno del servidor", 500);
  }
};
