// src/pages/api/admin/drive-sync.ts
// API endpoint to trigger Drive sync from the admin UI
// NOTE: This endpoint currently returns a placeholder response.
// Actual sync execution requires googleapis on the server,
// which may not be available in Vercel serverless functions.
// For production, run the sync script directly via terminal.

export const prerender = false;

import type { APIRoute } from "astro";

export const POST: APIRoute = async ({ request, cookies }) => {
    // Check admin session
    const adminPass = cookies.get("admin_pass")?.value;
    if (adminPass !== import.meta.env.ADMIN_PASS) {
        return new Response(
            JSON.stringify({ ok: false, error: "No autorizado. Inicia sesión como admin." }),
            { status: 401, headers: { "Content-Type": "application/json" } }
        );
    }

    try {
        const body = await request.json();
        const syncType = body.type || "all";

        if (!["exams", "solutions", "all"].includes(syncType)) {
            return new Response(
                JSON.stringify({ ok: false, error: "Tipo inválido. Usa: exams, solutions, o all" }),
                { status: 400, headers: { "Content-Type": "application/json" } }
            );
        }

        // Check if required env vars are set
        const hasExamsFolderId = !!import.meta.env.DRIVE_EXAMS_FOLDER_ID;
        const hasSolutionsFolderId = !!import.meta.env.DRIVE_SOLUTIONS_FOLDER_ID;
        const hasGoogleCreds = !!import.meta.env.GOOGLE_APPLICATION_CREDENTIALS;

        const missingVars: string[] = [];
        if (!hasGoogleCreds) missingVars.push("GOOGLE_APPLICATION_CREDENTIALS");
        if ((syncType === "exams" || syncType === "all") && !hasExamsFolderId) {
            missingVars.push("DRIVE_EXAMS_FOLDER_ID");
        }
        if ((syncType === "solutions" || syncType === "all") && !hasSolutionsFolderId) {
            missingVars.push("DRIVE_SOLUTIONS_FOLDER_ID");
        }

        if (missingVars.length > 0) {
            return new Response(
                JSON.stringify({
                    ok: false,
                    error: `Variables de entorno faltantes: ${missingVars.join(", ")}`,
                    hint: "Ejecuta el sync desde terminal: npm run drive:sync-solutions",
                }),
                { status: 500, headers: { "Content-Type": "application/json" } }
            );
        }

        // NOTE: Running the actual sync in a serverless function is not recommended
        // because it can timeout. The sync script is designed to run as a CLI tool.
        // For now, we return instructions to run manually.

        return new Response(
            JSON.stringify({
                ok: false,
                error: "La sincronización desde el navegador aún no está implementada",
                hint: `Ejecuta desde terminal: npm run drive:sync${syncType === "all" ? "" : `-${syncType}`}`,
                commands: {
                    exams: "npm run drive:sync-exams",
                    solutions: "npm run drive:sync-solutions",
                    all: "npm run drive:sync",
                },
            }),
            { status: 501, headers: { "Content-Type": "application/json" } }
        );

    } catch (err) {
        console.error("Error in drive-sync API:", err);
        return new Response(
            JSON.stringify({ ok: false, error: "Error interno del servidor" }),
            { status: 500, headers: { "Content-Type": "application/json" } }
        );
    }
};
