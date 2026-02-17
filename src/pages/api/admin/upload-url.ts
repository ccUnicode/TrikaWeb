// src/pages/api/admin/upload-url.ts
// Generates a signed upload URL so the browser can upload PDFs
// directly to Supabase Storage, bypassing Vercel's 4.5 MB body limit.

export const prerender = false;

import type { APIRoute } from "astro";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { validateAdminSession } from "../../../lib/adminAuth";

export const POST: APIRoute = async ({ request, cookies }) => {
    // Validate admin session via cookie
    const isAdmin = await validateAdminSession(cookies);
    if (!isAdmin) {
        return new Response(
            JSON.stringify({ ok: false, error: "No autorizado. Inicia sesión como admin." }),
            { status: 401, headers: { "Content-Type": "application/json" } }
        );
    }

    // Parse JSON body
    let body: Record<string, string>;
    try {
        body = await request.json();
    } catch {
        return new Response(
            JSON.stringify({ ok: false, error: "Body JSON inválido" }),
            { status: 400, headers: { "Content-Type": "application/json" } }
        );
    }

    const courseCode = String(body.course_code ?? "").trim().toUpperCase();
    const cycle = String(body.cycle ?? "").trim();
    const examType = String(body.exam_type ?? "").trim();
    const resourceKind = String(body.resource_kind ?? "").trim().toUpperCase();

    if (!courseCode || !cycle || !examType || !resourceKind) {
        return new Response(
            JSON.stringify({ ok: false, error: "Faltan campos requeridos" }),
            { status: 400, headers: { "Content-Type": "application/json" } }
        );
    }

    if (!["PLANCHA", "SOLUCIONARIO"].includes(resourceKind)) {
        return new Response(
            JSON.stringify({ ok: false, error: "resource_kind inválido" }),
            { status: 400, headers: { "Content-Type": "application/json" } }
        );
    }

    // Resolve course
    const { data: course, error: courseError } = await supabaseAdmin
        .from("courses")
        .select("id, code")
        .ilike("code", courseCode)
        .single();

    if (courseError || !course) {
        return new Response(
            JSON.stringify({ ok: false, error: "course_code no encontrado" }),
            { status: 404, headers: { "Content-Type": "application/json" } }
        );
    }

    const courseId = course.id;
    const normalizedCode = (course.code ?? courseCode).toUpperCase();

    // Build storage path & bucket
    const bucket = resourceKind === "SOLUCIONARIO" ? "solutions" : "exams";
    const safeCycle = cycle.replace(/[^a-zA-Z0-9\-_]/g, "_");
    const safeExam = examType.replace(/[^a-zA-Z0-9\-_]/g, "_");
    const path = `${normalizedCode}/${safeExam}/${safeCycle}.pdf`;

    // Generate signed upload URL
    const { data: signedData, error: signedError } = await supabaseAdmin.storage
        .from(bucket)
        .createSignedUploadUrl(path);

    if (signedError || !signedData) {
        console.error("Error creating signed upload URL:", signedError);
        return new Response(
            JSON.stringify({
                ok: false,
                error: "No se pudo generar la URL de subida. ¿El archivo ya existe?",
            }),
            { status: 500, headers: { "Content-Type": "application/json" } }
        );
    }

    return new Response(
        JSON.stringify({
            ok: true,
            signedUrl: signedData.signedUrl,
            token: signedData.token,
            path,
            bucket,
            courseId,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
    );
};
