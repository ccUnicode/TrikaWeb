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

  if (!Number.isSafeInteger(normalizedValue) || normalizedValue <= 0) {
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
 * POST /api/admin/courses
 *
 * Obtiene los cursos del panel administrativo con:
 * - búsqueda por código o nombre;
 * - filtro por estado;
 * - paginación;
 * - conteos globales de cursos visibles y ocultos.
 *
 * Si alguno de los conteos no puede calcularse, la solicitud
 * falla en lugar de mostrar el valor incorrecto 0.
 */
export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const isAdmin = await validateAdminSession(cookies);

    if (!isAdmin) {
      return jsonError("Sesión inválida", 401);
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
       * El cuerpo es opcional.
       * Cuando está vacío se utilizan los valores
       * predeterminados de filtros y paginación.
       */
      body = {};
    }

    const safePage = normalizePositiveInteger(body.page, 1);

    const requestedPageSize = normalizePositiveInteger(body.pageSize, 30);

    const safeSize = Math.min(requestedPageSize, 100);

    const normalizedSearch = String(body.search ?? "")
      .trim()
      .slice(0, 100);

    const normalizedStatus = normalizeStatusFilter(body.status);

    if (!normalizedStatus.valid) {
      return jsonError("Filtro de estado inválido", 400);
    }

    const status = normalizedStatus.value;

    const from = (safePage - 1) * safeSize;
    const to = from + safeSize - 1;

    /*
     * Consulta principal de cursos.
     * El count considera los filtros aplicados.
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

    if (normalizedSearch) {
      const pattern = `%${normalizedSearch}%`;

      coursesQuery = coursesQuery.or(
        `code.ilike.${pattern},name.ilike.${pattern}`,
      );
    }

    if (status !== null) {
      coursesQuery = coursesQuery.eq("status", status);
    }

    coursesQuery = coursesQuery
      .order("name", {
        ascending: true,
      })
      .range(from, to);

    /*
     * Los conteos de visibilidad son globales y no
     * dependen de la búsqueda ni del filtro de estado.
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

    const { data, count, error: coursesError } = coursesResult;

    if (coursesError) {
      console.error("Error fetching courses:", coursesError);

      return jsonError("Error al obtener cursos", 500);
    }

    /*
     * No se sustituye un fallo de conteo por cero.
     * Un error o un count nulo significa que el dato
     * no está disponible y la respuesta no es confiable.
     */
    if (
      visibleCountResult.error ||
      hiddenCountResult.error ||
      visibleCountResult.count === null ||
      hiddenCountResult.count === null
    ) {
      console.error("Error fetching course visibility counts:", {
        visibleError: visibleCountResult.error,
        hiddenError: hiddenCountResult.error,
        visibleCount: visibleCountResult.count,
        hiddenCount: hiddenCountResult.count,
      });

      return jsonError(
        "No se pudieron calcular los conteos de visibilidad",
        500,
      );
    }

    /*
     * La consulta principal también solicitó count exacto.
     * Si llega nulo sin error, no se debe inventar un cero.
     */
    if (count === null) {
      console.error("La consulta de cursos no devolvió el conteo total.");

      return jsonError("No se pudo calcular el total de cursos", 500);
    }

    const total = count;

    const totalPages = total > 0 ? Math.ceil(total / safeSize) : 0;

    const courses = (data ?? []).map((course) => ({
      id: course.id,
      code: course.code,
      name: course.name,
      credits: course.credits ?? 0,
      is_hidden: course.is_hidden ?? false,
      status: course.status as CourseStatus,
    }));

    return Response.json(
      {
        ok: true,
        courses,
        counts: {
          visible: visibleCountResult.count,
          hidden: hiddenCountResult.count,
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

    return jsonError("Error interno del servidor", 500);
  }
};
