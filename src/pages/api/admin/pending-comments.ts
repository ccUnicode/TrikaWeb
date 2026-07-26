export const prerender = false;

import type { APIRoute } from "astro";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { validateAdminSession } from "../../../lib/adminAuth";

export const POST: APIRoute = async ({ request, cookies }) => {
    const isValid = await validateAdminSession(cookies);
    if (!isValid) {
        return new Response(
            JSON.stringify({ ok: false, error: "Sesión inválida" }),
            { status: 401, headers: { "Content-Type": "application/json" } }
        );
    }

    let body: any;
    try {
        body = await request.json();
    } catch {
        return new Response(JSON.stringify({ ok: false, error: "JSON inválido" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
        });
    }

    const category = body?.category ?? "teachers"; // "teachers" | "sheets"
    const status = body?.status ?? "pending";       // "pending" | "all"
    const page = Number(body?.page ?? 1);
    const pageSize = Number(body?.pageSize ?? 20);
    const searchQuery = String(body?.search ?? "").trim().toLowerCase();

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    if (category === "sheets") {
        // ── Sheet Feedback ──
        // Use a flat select to avoid double-nested join issues with PostgREST
        let query = supabaseAdmin
            .from("sheet_feedback")
            .select(`
                id,
                stars,
                content,
                created_at,
                is_hidden,
                needs_review,
                sheet_id
            `, { count: "exact" })
            .order("created_at", { ascending: false });

        if (status === "pending") {
            query = query.eq("needs_review", true).eq("is_hidden", false);
        } else if (status === "all") {
            query = query.eq("needs_review", false);
        }

        if (searchQuery) {
            // Buscar en tablas relacionadas primero para los IDs
            const { data: allSheets } = await supabaseAdmin
                .from('sheets')
                .select('id, exam_type, cycle, courses(code)');
                
            const matchingSheetIds = (allSheets || []).filter((s: any) => {
                const course = Array.isArray(s.courses) ? s.courses[0] : s.courses;
                const label = `${course?.code ?? "?"} - ${s.exam_type ?? "Plancha"} ${s.cycle ?? ""}`.trim().toLowerCase();
                return label.includes(searchQuery);
            }).map(s => s.id);

            if (matchingSheetIds.length > 0) {
                query = query.or(`content.ilike.%${searchQuery}%,sheet_id.in.(${matchingSheetIds.join(',')})`);
            } else {
                query = query.ilike('content', `%${searchQuery}%`);
            }
        }

        query = query.range(from, to);

        const { data, error, count } = await query;

        if (error) {
            console.error("Error fetching sheet feedback:", error);
            return new Response(
                JSON.stringify({ ok: false, error: "Error al obtener feedback: " + error.message }),
                { status: 500, headers: { "Content-Type": "application/json" } }
            );
        }

        // Fetch sheet details separately to build labels
        const sheetIds = [...new Set((data ?? []).map((d: any) => d.sheet_id).filter(Boolean))];
        let sheetsMap: Record<number, string> = {};

        if (sheetIds.length > 0) {
            const { data: sheetsData } = await supabaseAdmin
                .from("sheets")
                .select("id, exam_type, cycle, courses:course_id (code, name)")
                .in("id", sheetIds);

            if (sheetsData) {
                for (const s of sheetsData) {
                    const course = Array.isArray((s as any).courses) ? (s as any).courses[0] : (s as any).courses;
                    sheetsMap[s.id] = `${course?.code ?? "?"} - ${(s as any).exam_type ?? "Plancha"} ${(s as any).cycle ?? ""}`.trim();
                }
            }
        }

        let items = (data ?? []).map((item: any) => ({
            id: item.id,
            stars: item.stars,
            content: item.content,
            created_at: item.created_at,
            is_hidden: item.is_hidden,
            needs_review: item.needs_review,
            sheet_id: item.sheet_id,
            sheet_label: sheetsMap[item.sheet_id] ?? "Plancha desconocida",
        }));

        // Filtro de búsqueda removido (ahora se hace en la base de datos)

        return new Response(
            JSON.stringify({
                ok: true,
                items,
                pagination: {
                    page,
                    pageSize,
                    total: count ?? 0,
                    totalPages: Math.ceil((count ?? 0) / pageSize),
                },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
        );
    } else {
        // ── Teacher Ratings (default) ──
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
                needs_review,
                teacher_id,
                teachers:teacher_id (
                    id,
                    full_name
                )
            `, { count: "exact" })
            .order("created_at", { ascending: false });

        if (status === "pending") {
            query = query.eq("needs_review", true).eq("is_hidden", false);
        } else if (status === "all") {
            query = query.eq("needs_review", false);
        }

        if (searchQuery) {
            // Pre-buscar IDs de profesores que coincidan
            const { data: allTeachers } = await supabaseAdmin
                .from('teachers')
                .select('id, full_name');
            
            const matchingTeacherIds = (allTeachers || [])
                .filter(t => t.full_name.toLowerCase().includes(searchQuery))
                .map(t => t.id);

            if (matchingTeacherIds.length > 0) {
                query = query.or(`comment.ilike.%${searchQuery}%,teacher_id.in.(${matchingTeacherIds.join(',')})`);
            } else {
                query = query.ilike('comment', `%${searchQuery}%`);
            }
        }

        query = query.range(from, to);

        const { data, error, count } = await query;

        if (error) {
            console.error("Error fetching teacher ratings:", error);
            return new Response(
                JSON.stringify({ ok: false, error: "Error al obtener calificaciones" }),
                { status: 500, headers: { "Content-Type": "application/json" } }
            );
        }

        let items = (data ?? []).map((item: any) => ({
            id: item.id,
            overall: item.overall,
            difficulty: item.difficulty,
            didactic: item.didactic,
            resources: item.resources,
            responsability: item.responsability,
            grading: item.grading,
            comment: item.comment,
            created_at: item.created_at,
            is_hidden: item.is_hidden,
            needs_review: item.needs_review,
            teacher_id: item.teacher_id,
            teacher_name: item.teachers?.full_name ?? "Profesor desconocido",
        }));

        // Filtro de búsqueda removido (ahora se hace en la base de datos)

        return new Response(
            JSON.stringify({
                ok: true,
                items,
                pagination: {
                    page,
                    pageSize,
                    total: count ?? 0,
                    totalPages: Math.ceil((count ?? 0) / pageSize),
                },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
        );
    }
};
