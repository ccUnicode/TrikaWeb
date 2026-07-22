export const prerender = false;

import type { APIRoute } from "astro";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { validateAdminSession } from "../../../lib/adminAuth";

const normalizeCode = (value: unknown) =>
  String(value ?? "")
    .trim()
    .toUpperCase();
const normalizeName = (value: unknown) => String(value ?? "").trim();
const normalizeCredits = (value: unknown) => {
  const num = Number(value);
  return Number.isInteger(num) ? num : NaN;
};

const normalizeSummary = (value: unknown) => String(value ?? "").trim();

const normalizeRequiredId = (value: unknown): number | null => {
  const num = Number(value);

  if (!Number.isInteger(num) || num <= 0) {
    return null;
  }

  return num;
};

const normalizeOptionalId = (
  value: unknown,
): { value: number | null; valid: boolean } => {
  if (value === undefined || value === null || value === "") {
    return {
      value: null,
      valid: true,
    };
  }

  const normalized = normalizeRequiredId(value);

  return {
    value: normalized,
    valid: normalized !== null,
  };
};

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const isValid = await validateAdminSession(cookies);
    if (!isValid) {
      return new Response(
        JSON.stringify({ ok: false, error: "Sesión inválida" }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    let body: any;
    try {
      body = await request.json();
    } catch {
      return new Response(
        JSON.stringify({ ok: false, error: "Body JSON inválido" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const code = normalizeCode(body.code);
    const name = normalizeName(body.name);
    const summary = normalizeSummary(body.summary);
    const credits = normalizeCredits(body.credits);
    const system_id = normalizeRequiredId(body.system_id);

    const normalizedSubsystem = normalizeOptionalId(body.subsystem_id);
    const subsystem_id = normalizedSubsystem.value;

    const rawSelectedEvaluations: unknown[] = Array.isArray(
      body.selected_evaluations,
    )
      ? body.selected_evaluations
      : [];

    const selected_evaluations: number[] = [
      ...new Set<number>(
        rawSelectedEvaluations
          .map((id: unknown): number => Number(id))
          .filter((id: number) => Number.isInteger(id) && id > 0),
      ),
    ];

    if (!summary) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "La sumilla del curso es obligatoria",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    if (summary.length > 1000) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "La sumilla no puede superar los 1000 caracteres",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    if (system_id === null) {
      return new Response(
        JSON.stringify({ ok: false, error: "Sistema inválido" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    if (!normalizedSubsystem.valid) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "Subsistema inválido",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    if (!code || code.length < 2) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "El código es requerido (mínimo 2 caracteres)",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    if (!name || name.length < 2) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "El nombre es requerido (mínimo 2 caracteres)",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    if (!Number.isInteger(credits) || credits <= 0) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "Los créditos deben ser un número entero mayor a 0",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    if (subsystem_id === null && selected_evaluations.length > 0) {
      return new Response(
        JSON.stringify({
          ok: false,
          error:
            "No se pueden seleccionar evaluaciones sin un subsistema de evaluación",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const { data: result, error: rpcError } = await supabaseAdmin.rpc(
      "create_course_with_evaluations",
      {
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
      console.error("Error calling create_course_with_evaluations:", rpcError);
      return new Response(
        JSON.stringify({
          ok: false,
          error: "Error al crear curso",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    if (!result?.ok) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: result?.error || "No se pudo crear el curso",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    return new Response(
      JSON.stringify({
        ok: true,
        course: result.course,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    console.error("add-course API error:", err);
    return new Response(
      JSON.stringify({ ok: false, error: "Error interno del servidor" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
};
