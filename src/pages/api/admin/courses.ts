export const prerender = false;

import type { APIRoute } from "astro";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { validateAdminSession } from "../../../lib/adminAuth";

type CourseStatus = "INCOMPLETO" | "COMPLETO" | "ARCHIVADO";

type CourseStatusFilter = "INCOMPLETO" | "COMPLETO";

const normalizePositiveInteger = (
  value: unknown,
  defaultValue: number,
): number => {
  const normalizedValue = Number(value);

  if (!Number.isInteger(normalizedValue) || normalizedValue <= 0) {
    return defaultValue;
  }

  return normalizedValue;
};

const normalizeStatusFilter = (
  value: unknown,
): {
  value: CourseStatusFilter | null;
  valid: boolean;
} => {
  if (value === undefined || value === null || value === "") {
    return {
      value: null,
      valid: true,
    };
  }

  if (typeof value !== "string") {
    return {
      value: null,
      valid: false,
    };
  }

  const normalizedValue = value.trim().toUpperCase();

  if (normalizedValue !== "COMPLETO" && normalizedValue !== "INCOMPLETO") {
    return {
      value: null,
      valid: false,
    };
  }

  return {
    value: normalizedValue as CourseStatusFilter,
    valid: true,
  };
};

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const isValid = await validateAdminSession(cookies);

    if (!isValid) {
      return Response.json(
        {
          ok: false,
          error: "Sesión inválida",
        },
        {
          status: 401,
        },
      );
    }

    let body: Record<string, unknown> = {};

    try {
      const parsedBody: unknown = await request.json();

      if (
        parsedBody &&
        typeof parsedBody === "object" &&
        !Array.isArray(parsedBody)
      ) {
        body = parsedBody as Record<string, unknown>;
      }
    } catch {
      /*
       * El body es opcional.
       * Se utilizan los valores predeterminados.
       */
      body = {};
    }

    const safePage = normalizePositiveInteger(body.page, 1);

    const requestedPageSize = normalizePositiveInteger(body.pageSize, 30);

    /*
     * Limita el número de registros por página
     * para evitar consultas demasiado grandes.
     */
    const safeSize = Math.min(requestedPageSize, 100);

    /*
     * Limita la búsqueda para evitar cadenas
     * innecesariamente extensas.
     */
    const normalizedSearch = String(body.search ?? "")
      .trim()
      .slice(0, 100);

    const normalizedStatus = normalizeStatusFilter(body.status);

    if (!normalizedStatus.valid) {
      return Response.json(
        {
          ok: false,
          error: "Filtro de estado inválido",
        },
        {
          status: 400,
        },
      );
    }

    const status = normalizedStatus.value;

    const from = (safePage - 1) * safeSize;

    const to = from + safeSize - 1;

    /*
     * Se construye primero la consulta base.
     *
     * Los filtros se aplican antes de:
     * - ordenar;
     * - paginar;
     * - calcular el total.
     */
    let coursesQuery = supabaseAdmin.from("courses").select(
      `
          id,
          code,
          name,
          credits,
          is_hidden,
          status
        `,
      {
        count: "exact",
      },
    );

    /*
     * Búsqueda por código o nombre.
     */
    if (normalizedSearch) {
      const pattern = `%${normalizedSearch}%`;

      coursesQuery = coursesQuery.or(
        `code.ilike.${pattern},name.ilike.${pattern}`,
      );
    }

    /*
     * Filtro por estado.
     *
     * null        → todos
     * COMPLETO    → completos
     * INCOMPLETO  → pendientes
     */
    if (status !== null) {
      coursesQuery = coursesQuery.eq("status", status);
    }

    /*
     * El orden y la paginación se aplican
     * después de los filtros.
     */
    coursesQuery = coursesQuery
      .order("name", {
        ascending: true,
      })
      .range(from, to);

    /*
     * Los conteos de visibilidad permanecen globales.
     * No dependen del filtro de estado.
     */
    const [coursesResult, visibleCountResult, hiddenCountResult] =
      await Promise.all([
        coursesQuery,

        supabaseAdmin
          .from("courses")
          .select("id", {
            count: "exact",
            head: true,
          })
          .eq("is_hidden", false),

        supabaseAdmin
          .from("courses")
          .select("id", {
            count: "exact",
            head: true,
          })
          .eq("is_hidden", true),
      ]);

    const { data, count, error } = coursesResult;

    if (error) {
      console.error("Error fetching courses:", error);

      return Response.json(
        {
          ok: false,
          error: "Error al obtener cursos",
        },
        {
          status: 500,
        },
      );
    }

    if (visibleCountResult.error || hiddenCountResult.error) {
      console.error(
        "Error fetching course counts:",
        visibleCountResult.error || hiddenCountResult.error,
      );
    }

    /*
     * Este total ya considera:
     * - búsqueda;
     * - filtro de estado.
     */
    const total = count ?? 0;

    const totalPages = total > 0 ? Math.ceil(total / safeSize) : 0;

    const courses = (data ?? []).map((course) => ({
      id: course.id,
      code: course.code,
      name: course.name,
      credits: course.credits ?? 0,
      is_hidden: course.is_hidden ?? false,
      status: course.status as CourseStatus,
    }));

    const visibleCount = visibleCountResult.count ?? 0;

    const hiddenCount = hiddenCountResult.count ?? 0;

    return Response.json(
      {
        ok: true,
        courses,
        counts: {
          visible: visibleCount,
          hidden: hiddenCount,
        },
        filters: {
          search: normalizedSearch,
          status,
        },
        pagination: {
          page: safePage,
          pageSize: safeSize,
          total,
          totalPages,
        },
      },
      {
        status: 200,
      },
    );
  } catch (error) {
    console.error("courses API error:", error);

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
