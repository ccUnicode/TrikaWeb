// src/pages/api/admin/upload.ts

export const prerender = false; // necesario para aceptar POST

import type { APIRoute } from "astro";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { Buffer } from "node:buffer";

export const GET: APIRoute = () => {
  return new Response(
    JSON.stringify({ ok: true, route: "/api/admin/upload" }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
};

export const POST: APIRoute = async ({ request }) => {
  // 1) Verificar Content-Type
  const contentType = request.headers.get("content-type") || "";

  if (
    !contentType.startsWith("multipart/form-data") &&
    !contentType.startsWith("application/x-www-form-urlencoded")
  ) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: `Content-Type inválido: ${contentType}`,
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // 2) Leer formulario
  const formData = await request.formData();

  const adminPass = String(formData.get("admin_pass") ?? "").trim();
  const courseId = String(formData.get("course_id") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const cycle = String(formData.get("cycle") ?? "").trim();
  const resourceKind = String(formData.get("resource_kind") ?? "").trim(); // PLANCHA / SOLUCIONARIO
  const bucket = String(formData.get("bucket") ?? "").trim();             // exams / solutions
  const file = formData.get("file") as File | null;

  // 3) Validar clave ADMIN_PASS
  if (adminPass !== (import.meta.env.ADMIN_PASS as string)) {
    return new Response(
      JSON.stringify({ ok: false, error: "Clave de administrador incorrecta" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  // 4) Validar campos
  if (!courseId || !title || !cycle || !resourceKind || !bucket || !file) {
    return new Response(
      JSON.stringify({ ok: false, error: "Faltan campos o archivo" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    // 5) Subir archivo a Storage (bucket: exams / solutions)
    const arrayBuffer = await file.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);

    // ruta interna dentro del bucket, ej: "1/2024-II/PC_N1_nombre.pdf"
    const safeTitle = title.replace(/\s+/g, "_");
    const path = `${courseId}/${cycle}/${Date.now()}_${safeTitle}.pdf`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from(bucket)
      .upload(path, fileBuffer, {
        contentType: "application/pdf",
        upsert: false,
      });

    if (uploadError) {
      console.error("Error al subir a Storage:", uploadError);
      return new Response(
        JSON.stringify({ ok: false, error: "Error al subir el archivo a Storage" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // 6) Insertar fila en la tabla sheets
    const { error: insertError } = await supabaseAdmin
      .from("sheets")
      .insert([
        {
          course_id: Number(courseId),
          title,
          cycle,
          resource_kind: resourceKind, // "PLANCHA" o "SOLUCIONARIO"
          storage_path: path,
          // si en la tabla existe storage_bucket, descomenta:
          // storage_bucket: bucket,
        },
      ]);

    if (insertError) {
      console.error("Error al insertar en sheets:", insertError);
      return new Response(
        JSON.stringify({
          ok: false,
          error: "Archivo subido, pero falló el registro en la tabla sheets",
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // 7) Todo ok
    return new Response(
      JSON.stringify({
        ok: true,
        message: "Archivo subido y registrado en sheets correctamente",
        bucket,
        path,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error inesperado en /api/admin/upload:", err);
    return new Response(
      JSON.stringify({ ok: false, error: "Error interno en el servidor" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};