import dotenv from "dotenv";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";

import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import { createCanvas } from "canvas";

const FORCE = process.argv.includes("--force");

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const workerPath = path.join(
  __dirname,
  "../node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs"
);

pdfjsLib.GlobalWorkerOptions.workerSrc = pathToFileURL(workerPath).href;

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function fileExists(bucket, filePath) {
  // List by prefix trick (Supabase doesn't have direct HEAD in JS client)
  const parts = filePath.split("/");
  const fileName = parts.pop();
  const folder = parts.join("/");

  const { data, error } = await supabase.storage
    .from(bucket)
    .list(folder, { limit: 1000, search: fileName });

  if (error) return false;
  return (data || []).some((x) => x.name === fileName);
}

async function downloadFromStorage(bucket, storagePath, outPath) {
  const { data, error } = await supabase.storage.from(bucket).download(storagePath);
  if (error || !data) throw error || new Error("Download failed");

  const buffer = Buffer.from(await data.arrayBuffer());
  fs.writeFileSync(outPath, buffer);
}

async function renderFirstPageToJpg(pdfPath) {
  const fileData = new Uint8Array(fs.readFileSync(pdfPath));
  
  const loadingTask = pdfjsLib.getDocument({
    data: fileData,
    standardFontDataUrl: path.join(__dirname, "../node_modules/pdfjs-dist/standard_fonts/"),
  });
  
  const pdfDocument = await loadingTask.promise;
  const page = await pdfDocument.getPage(1);
  
  const scale = 1.8;
  const viewport = page.getViewport({ scale });
  
  // Utilizar canvas para renderizar directamente en Node.js, sin Puppeteer
  const canvas = createCanvas(Math.floor(viewport.width), Math.floor(viewport.height));
  const ctx = canvas.getContext("2d");
  
  await page.render({ canvasContext: ctx, viewport }).promise;
  
  return canvas.toBuffer("image/jpeg", { quality: 0.9 });
}

async function uploadThumb(buffer, thumbPath) {
  const { error } = await supabase.storage
    .from("thumbnails")
    .upload(thumbPath, buffer, {
      contentType: "image/jpeg",
      upsert: true,
    });

  if (error) throw error;
}

async function main() {
  console.log("Rebuilding missing thumbnails...");

  try {
    // Trae sheets en “páginas” para no reventar memoria
    let from = 0;
    const pageSize = 200;

    while (true) {
      const { data: sheets, error } = await supabase
        .from("sheets")
        .select("id, exam_storage_path, thumb_storage_path")
        .not("exam_storage_path", "is", null)
        .range(from, from + pageSize - 1);

      if (error) throw error;
      if (!sheets || sheets.length === 0) break;

      // Procesamos en lotes para no reventar la memoria (cola de promesas)
      const CONCURRENCY = 5;
      for (let i = 0; i < sheets.length; i += CONCURRENCY) {
        const batch = sheets.slice(i, i + CONCURRENCY);
        
        await Promise.all(batch.map(async (s) => {
          const examPath = s.exam_storage_path;
          if (!examPath) return;

          const thumbPath =
            s.thumb_storage_path || examPath.replace(/\.pdf$/i, ".jpg");

          const exists = await fileExists("thumbnails", thumbPath);
          if (exists && !FORCE) return;

          console.log("Missing thumb:", thumbPath, "for", examPath);

          const tmpDir = path.join(__dirname, "../tmp-thumbs");
          if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

          const tmpPdf = path.join(tmpDir, `${s.id}.pdf`);

          try {
            // 1) download pdf
            await downloadFromStorage("exams", examPath, tmpPdf);

            // 2) render
            const jpgBuffer = await renderFirstPageToJpg(tmpPdf);

            // 3) upload thumb
            await uploadThumb(jpgBuffer, thumbPath);

            // 4) ensure DB points to it
            if (!s.thumb_storage_path) {
              await supabase
                .from("sheets")
                .update({ thumb_storage_path: thumbPath })
                .eq("id", s.id);
            }

            console.log("✅ created:", thumbPath);
          } catch (e) {
            console.error("❌ failed:", examPath, e);
          } finally {
            if (fs.existsSync(tmpPdf)) fs.unlinkSync(tmpPdf);
          }
        }));
      }

      from += pageSize;
    }

    console.log("Done.");
  } catch (err) {
    console.error("Critical error:", err);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});