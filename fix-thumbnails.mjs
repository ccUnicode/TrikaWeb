import { createClient } from "@supabase/supabase-js";
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Use pdf2pic for PDF to Image conversion
import { fromPath } from 'pdf2pic';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("Faltan variables de entorno SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function main() {
    console.log("=== INICIANDO RECUPERACIÓN DE MINIATURAS ===");

    // 1. Buscar planchas que no tengan thumb_storage_path pero sí tengan exam_storage_path
    const { data: sheets, error } = await supabase
        .from('sheets')
        .select('id, exam_storage_path, thumb_storage_path')
        .is('thumb_storage_path', null)
        .not('exam_storage_path', 'is', null);

    if (error) {
        console.error("❌ Error buscando planchas:", error);
        return;
    }

    if (!sheets || sheets.length === 0) {
        console.log("✅ ¡Todas las planchas tienen miniatura asignada! No hay nada que arreglar.");
        return;
    }

    console.log(`⚠️ Encontradas ${sheets.length} planchas sin miniatura. Iniciando proceso...`);

    const tmpDir = path.join(__dirname, 'tmp-thumbs');
    if (!fs.existsSync(tmpDir)) {
        fs.mkdirSync(tmpDir, { recursive: true });
    }

    let successCount = 0;
    let errorCount = 0;

    for (const sheet of sheets) {
        console.log(`\nProcesando ID ${sheet.id}: ${sheet.exam_storage_path}`);

        const localPdfPath = path.join(tmpDir, `${sheet.id}.pdf`);
        const thumbPath = sheet.exam_storage_path.replace(/\.pdf$/i, '.jpg');

        try {
            // 1. Descargar el PDF de Supabase
            console.log(`  ⬇️ Descargando PDF...`);
            const { data: pdfData, error: downloadError } = await supabase.storage
                .from('exams')
                .download(sheet.exam_storage_path);

            if (downloadError || !pdfData) throw new Error(`Falló la descarga: ${downloadError?.message}`);

            const arrayBuffer = await pdfData.arrayBuffer();
            fs.writeFileSync(localPdfPath, Buffer.from(arrayBuffer));

            // 2. Renderizar la primera página
            console.log(`  🖼️ Generando miniatura...`);

            const options = {
                density: 150,
                saveFilename: `${sheet.id}`,
                savePath: tmpDir,
                format: "jpg",
                width: 1024,
                height: 1448
            };

            const storeAsImage = fromPath(localPdfPath, options);
            const dataToReturn = await storeAsImage(1);

            if (!dataToReturn || !dataToReturn.path) {
                throw new Error("No se pudo generar la imagen");
            }

            const imageBuffer = fs.readFileSync(dataToReturn.path);

            // 3. Subir el JPEG a Supabase Storage
            console.log(`  ⬆️ Subiendo miniatura a: thumbnails/${thumbPath}`);
            const { error: uploadError } = await supabase.storage
                .from('thumbnails')
                .upload(thumbPath, imageBuffer, {
                    contentType: 'image/jpeg',
                    upsert: true
                });

            if (uploadError) throw new Error(`Falló subida Storage: ${uploadError.message}`);

            // 4. Actualizar la base de datos
            console.log(`  📝 Actualizando registro en DB...`);
            const { error: updateError } = await supabase
                .from('sheets')
                .update({ thumb_storage_path: thumbPath })
                .eq('id', sheet.id);

            if (updateError) throw new Error(`Falló update DB: ${updateError.message}`);

            console.log(`  ✅ Completado con éxito!`);
            successCount++;

        } catch (err) {
            console.error(`  ❌ Error procesando ID ${sheet.id}:`, err.message);
            errorCount++;
        }
    }

    console.log(`\n=== PROCESO FINALIZADO ===`);
    console.log(`✅ Miniaturas generadas y enlazadas: ${successCount}`);
    if (errorCount > 0) {
        console.log(`❌ Errores encontrados: ${errorCount}`);
    }

    // Limpiar carpeta temporal
    if (fs.existsSync(tmpDir)) {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
}

main().catch(console.error);
