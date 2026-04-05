import dotenv from "dotenv";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import { createCanvas } from "canvas";
import pLimit from "p-limit";

const FORCE = process.argv.includes("--force");

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const workerPath = path.join(
  __dirname,
  "../node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs"
);

pdfjsLib.GlobalWorkerOptions.workerSrc = workerPath;

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function retry(fn, retries = 3, delay = 1000) {
  try {
    return await fn();
  } catch (err) {
    if (retries <= 0) throw err;
    await sleep(delay);
    return retry(fn, retries - 1, delay * 2);
  }
}

async function fileExists(bucket, filePath) {
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
  const pdf = await pdfjsLib.getDocument(pdfPath).promise;
  const page = await pdf.getPage(1);

  const scale = 1.5;
  const viewport = page.getViewport({ scale });

  const canvas = createCanvas(viewport.width, viewport.height);
  const context = canvas.getContext("2d");

  await page.render({
    canvasContext: context,
    viewport,
  }).promise;

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

  const limit = pLimit(5);

  try {
    let from = 0;
    const pageSize = 200;

    const tmpDir = path.join(__dirname, "../tmp-thumbs");
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

    while (true) {
      const { data: sheets, error } = await supabase
        .from("sheets")
        .select("id, exam_storage_path, thumb_storage_path")
        .not("exam_storage_path", "is", null)
        .range(from, from + pageSize - 1);

      if (error) throw error;
      if (!sheets || sheets.length === 0) break;

      await Promise.all(
        sheets.map((s) =>
          limit(async () => {
            const examPath = s.exam_storage_path;
            if (!examPath) return;

            const thumbPath =
              s.thumb_storage_path || examPath.replace(/\.pdf$/i, ".jpg");

            const exists = await fileExists("thumbnails", thumbPath);
            if (exists && !FORCE) return;

            console.log("Missing thumb:", thumbPath);

            const tmpPdf = path.join(tmpDir, `${s.id}.pdf`);

            try {
              await retry(() =>
                downloadFromStorage("exams", examPath, tmpPdf)
              );

              const jpgBuffer = await renderFirstPageToJpg(tmpPdf);

              await retry(() => uploadThumb(jpgBuffer, thumbPath));

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
          })
        )
      );

      from += pageSize;
    }

    console.log("Done.");
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

main();