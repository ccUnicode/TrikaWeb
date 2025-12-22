export const prerender = false;

import type { APIRoute } from "astro";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

export const POST: APIRoute = async ({ request }) => {
    let body: any;
    try {
        body = await request.json();
    } catch {
        return new Response(JSON.stringify({ ok: false, error: "JSON inválido" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
        });
    }

    const adminPass = String(body?.admin_pass ?? "");
    const page = Number(body?.page ?? 1);
    const pageSize = Number(body?.pageSize ?? 20);
    const teacherFilter = body?.teacher_id ? Number(body.teacher_id) : null;
    const searchQuery = String(body?.search ?? "").trim().toLowerCase();

    if (!adminPass) {
        return new Response(
            JSON.stringify({ ok: false, error: "Falta admin_pass" }),
            { status: 400, headers: { "Content-Type": "application/json" } }
        );
    }

    if (adminPass !== (import.meta.env.ADMIN_PASS as string)) {
        return new Response(
            JSON.stringify({ ok: false, error: "Clave de administrador incorrecta" }),
            { status: 401, headers: { "Content-Type": "application/json" } }
        );
    }

    // Obtener todas las calificaciones visibles
    let query = supabaseAdmin
        .from("teacher_ratings")
        .select(`
      id,
      overall,
      difficulty,
      didactic,
      resources,
      responsability,
      grading,
      comment,
      created_at,
      is_hidden,
      teacher_id,
      teachers:teacher_id (
        id,
        full_name
      )
    `)
        .eq("is_hidden", false)
        .order("created_at", { ascending: false });

    // Filtrar por profesor si se especifica
    if (teacherFilter) {
        query = query.eq("teacher_id", teacherFilter);
    }

    // Paginación
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    const { data: ratings, error, count } = await query;

    if (error) {
        console.error("Error all-ratings:", error);
        return new Response(
            JSON.stringify({ ok: false, error: "No se pudieron obtener las calificaciones" }),
            { status: 500, headers: { "Content-Type": "application/json" } }
        );
    }

    // Filtrar por búsqueda de texto (nombre del profesor)
    let filteredRatings = ratings ?? [];
    if (searchQuery && filteredRatings.length > 0) {
        filteredRatings = filteredRatings.filter((r: any) => {
            const teacherName = (r.teachers?.full_name ?? "").toLowerCase();
            const comment = (r.comment ?? "").toLowerCase();
            return teacherName.includes(searchQuery) || comment.includes(searchQuery);
        });
    }

    // Obtener el conteo total
    const { count: totalCount } = await supabaseAdmin
        .from("teacher_ratings")
        .select("id", { count: "exact", head: true })
        .eq("is_hidden", false);

    return new Response(
        JSON.stringify({
            ok: true,
            ratings: filteredRatings,
            pagination: {
                page,
                pageSize,
                total: searchQuery ? filteredRatings.length : (totalCount ?? 0),
                totalPages: searchQuery ? 1 : Math.ceil((totalCount ?? 0) / pageSize),
            },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
    );
};
