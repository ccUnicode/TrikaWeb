export const prerender = false;

import type { APIRoute } from "astro";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { validateAdminSession } from "../../../lib/adminAuth";

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

  if (!Number.isInteger(normalizedValue) || normalizedValue <= 0) {
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

    const course_id = normalizeRequiredId(body.course_id);

    const code = normalizeCode(body.code);
    const name = normalizeName(body.name);
    const summary = normalizeSummary(body.summary);

    const credits = normalizeCredits(body.credits);

    const system_id = normalizeRequiredId(body.system_id);

    const normalizedSubsystem = normalizeOptionalId(body.subsystem_id);

    const subsystem_id = normalizedSubsystem.value;

    if (
      body.selected_evaluations !== undefined &&
      !Array.isArray(body.selected_evaluations)
    ) {
      return jsonError(
        "Las evaluaciones seleccionadas deben enviarse como una lista",
        400,
      );
    }

    const rawSelectedEvaluations: unknown[] = Array.isArray(
      body.selected_evaluations,
    )
      ? body.selected_evaluations
      : [];

    const selected_evaluations: number[] = [
      ...new Set<number>(
        rawSelectedEvaluations
          .map((evaluationId: unknown): number => Number(evaluationId))
          .filter(
            (evaluationId: number) =>
              Number.isInteger(evaluationId) && evaluationId > 0,
          ),
      ),
    ];

    if (course_id === null) {
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

    if (system_id === null) {
      return jsonError("Debe seleccionar un sistema de evaluación válido", 400);
    }

    if (!normalizedSubsystem.valid) {
      return jsonError("Subsistema inválido", 400);
    }

    if (subsystem_id === null && selected_evaluations.length > 0) {
      return jsonError(
        "No se pueden seleccionar evaluaciones sin un subsistema de evaluación",
        400,
      );
    }

    const { data: result, error: rpcError } = await supabaseAdmin.rpc(
      "update_course_with_evaluations",
      {
        p_course_id: course_id,
        p_code: code,
        p_name: name,
        p_summary: summary,
        p_credits: credits,
        p_system_id: system_id,
        p_subsystem_id: subsystem_id,
        p_selected_evaluations: selected_evaluations,
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
