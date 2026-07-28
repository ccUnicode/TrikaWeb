export const prerender = false;

import type { APIRoute } from "astro";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { validateAdminSession } from "../../../lib/adminAuth";

interface DeleteCourseResult {
  ok: boolean;
  code?: "invalid_id" | "not_found" | "course_has_sheets";
  error?: string;
}

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
 * POST /api/admin/delete-course
 *
 * Elimina un curso únicamente cuando no tiene planchas asociadas.
 *
 * Los cursos con planchas deben ocultarse mediante is_hidden.
 * Esto evita que ON DELETE CASCADE elimine los registros de sheets
 * mientras los PDF, solucionarios y miniaturas permanecen huérfanos
 * en Supabase Storage.
 */
export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const isAdmin = await validateAdminSession(cookies);

    if (!isAdmin) {
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
        return jsonError("Cuerpo de petición inválido o vacío", 400);
      }

      body = parsedBody as Record<string, unknown>;
    } catch {
      return jsonError("Cuerpo de petición inválido o vacío", 400);
    }

    const courseId = Number(body.course_id);

    if (!Number.isSafeInteger(courseId) || courseId <= 0) {
      return jsonError("ID de curso inválido", 400);
    }

    /*
     * La RPC bloquea el curso, comprueba que no tenga planchas
     * y realiza la eliminación dentro de una sola transacción.
     */
    const { data, error: rpcError } = await supabaseAdmin.rpc(
      "delete_empty_course",
      {
        p_course_id: courseId,
      },
    );

    if (rpcError) {
      console.error("Error calling delete_empty_course:", rpcError);

      return jsonError("Error al eliminar el curso", 500);
    }

    const result = data as DeleteCourseResult | null;

    if (!result || typeof result.ok !== "boolean") {
      console.error("Respuesta inválida de delete_empty_course:", data);

      return jsonError("No se pudo procesar la eliminación", 500);
    }

    if (!result.ok) {
      switch (result.code) {
        case "invalid_id":
          return jsonError(result.error || "ID de curso inválido", 400);

        case "not_found":
          return jsonError(result.error || "Curso no encontrado", 404);

        case "course_has_sheets":
          return jsonError(
            result.error ||
              "El curso tiene planchas asociadas y debe ocultarse en lugar de eliminarse",
            409,
          );

        default:
          return jsonError(result.error || "No se pudo eliminar el curso", 400);
      }
    }

    return Response.json(
      {
        ok: true,
        message: "Curso eliminado correctamente",
      },
      {
        status: 200,
      },
    );
  } catch (error) {
    console.error("delete-course API error:", error);

    return jsonError("Error interno del servidor", 500);
  }
};
