export const prerender = false;
import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";
import { Buffer } from "node:buffer";

const admin = () =>
  createClient(import.meta.env.SUPABASE_URL!, import.meta.env.SUPABASE_SERVICE_KEY!);

export const GET: APIRoute = async ({ params, request }) => {
  const id = Number(params.id);
  const supa = admin();
  const url = new URL(request.url);
  const streamMode = url.searchParams.get("mode") === "stream";

  const { data: sheet } = await supa
    .from("sheets")
    .select("exam_storage_path")
    .eq("id", id)
    .single();

  if (!sheet?.exam_storage_path) return new Response("Not found", { status: 404 });

  if (streamMode) {
    const { data, error } = await supa.storage.from("exams").download(sheet.exam_storage_path);
    if (error || !data) {
      console.error("Error descargando PDF:", error);
      return new Response("Download error", { status: 500 });
    }
    const buffer = Buffer.from(await data.arrayBuffer());
    const filename = sheet.exam_storage_path.split("/").pop() || "plancha.pdf";
    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": "private, max-age=600",
      },
    });
  }

  const { data, error } = await supa.storage
    .from("exams")
    .createSignedUrl(sheet.exam_storage_path, 120);

  if (error || !data?.signedUrl) return new Response("Sign error", { status: 500 });
  return Response.redirect(data.signedUrl, 302);
};
