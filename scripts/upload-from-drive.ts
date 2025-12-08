
import dotenv from 'dotenv';

// Try loading .env and .env.local
dotenv.config({ path: '.env' });
dotenv.config({ path: '.env.local' }); // Will populate variables that are not yet defined

import { google } from 'googleapis';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- CONFIGURATION ---
const SERVICE_ACCOUNT_PATH = process.env.GOOGLE_APPLICATION_CREDENTIALS;
const DRIVE_EXAMS_FOLDER_ID = process.env.DRIVE_EXAMS_FOLDER_ID;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

const missingVars = [];
if (!SERVICE_ACCOUNT_PATH) missingVars.push('GOOGLE_APPLICATION_CREDENTIALS');
if (!DRIVE_EXAMS_FOLDER_ID) missingVars.push('DRIVE_EXAMS_FOLDER_ID');
if (!SUPABASE_URL) missingVars.push('SUPABASE_URL');
if (!SUPABASE_SERVICE_ROLE_KEY) missingVars.push('SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SERVICE_KEY)');

if (missingVars.length > 0) {
    console.error('Error: Missing environment variables:');
    missingVars.forEach(v => console.error(`  - ${v}`));
    console.error('Ensure these are set in .env or .env.local');
    process.exit(1);
}

// --- CLIENTS ---
// 1. Google Drive Client
const auth = new google.auth.GoogleAuth({
    keyFile: SERVICE_ACCOUNT_PATH!,
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
});
const drive = google.drive({ version: 'v3', auth });

// 2. Supabase Client
const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

// --- HELPER FUNCTIONS ---

/**
 * List all folders inside a specific parent folder.
 */
async function listFolders(parentId: string) {
    const folders: { id: string; name: string }[] = [];
    let pageToken: string | undefined = undefined;

    do {
        // Explicitly cast the response to avoid implicit 'any' on res for self-reference check in some TS configs,
        // and safely type the files array.
        const res: any = await drive.files.list({
            q: `'${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
            fields: 'nextPageToken, files(id, name)',
            pageToken,
        });

        const files = res.data.files;
        if (files) {
            files.forEach((file: any) => {
                if (file.id && file.name) {
                    folders.push({ id: file.id, name: file.name });
                }
            });
        }
        pageToken = res.data.nextPageToken || undefined;
    } while (pageToken);

    return folders;
}

/**
 * List all PDF files inside a specific parent folder.
 */
async function listPdfFiles(parentId: string) {
    const pdfs: { id: string; name: string }[] = [];
    let pageToken: string | undefined = undefined;

    do {
        const res: any = await drive.files.list({
            q: `'${parentId}' in parents and mimeType = 'application/pdf' and trashed = false`,
            fields: 'nextPageToken, files(id, name)',
            pageToken,
        });

        const files = res.data.files;
        if (files) {
            files.forEach((file: any) => {
                if (file.id && file.name) {
                    pdfs.push({ id: file.id, name: file.name });
                }
            });
        }
        pageToken = res.data.nextPageToken || undefined;
    } while (pageToken);

    return pdfs;
}

/**
 * Download a file from Drive to a local temporary path.
 */
async function downloadFile(fileId: string, destPath: string) {
    const dest = fs.createWriteStream(destPath);
    const res = await drive.files.get(
        { fileId, alt: 'media' },
        { responseType: 'stream' }
    );

    return new Promise<void>((resolve, reject) => {
        res.data
            .on('end', () => resolve())
            .on('error', (err) => reject(err))
            .pipe(dest);
    });
}

/**
 * Upload a local file to Supabase Storage.
 */
async function uploadToSupabaseStorage(localPath: string, storagePath: string) {
    const fileContent = fs.readFileSync(localPath);
    const { data, error } = await supabase.storage
        .from('exams')
        .upload(storagePath, fileContent, {
            contentType: 'application/pdf',
            upsert: true
        });

    if (error) throw error;
    return data;
}

// --- MAIN LOGIC ---

async function main() {
    console.log('--- STARTING DRIVE TO SUPABASE SYNC ---');
    console.log(`Root Folder ID: ${DRIVE_EXAMS_FOLDER_ID}`);

    const tmpDir = path.join(__dirname, '../tmp-drive');
    if (!fs.existsSync(tmpDir)) {
        fs.mkdirSync(tmpDir, { recursive: true });
    }

    try {
        // Level 1: Course Codes (e.g., BMA01, FIS101)
        console.log('Listing Level 1 folders (Courses)...');
        const courseFolders = await listFolders(DRIVE_EXAMS_FOLDER_ID!);
        console.log(`Found ${courseFolders.length} courses.`);

        for (const courseFolder of courseFolders) {
            const courseCode = courseFolder.name;
            console.log(`Processing Course: ${courseCode}`);

            // Level 2: Eval Labels (e.g., PC1, PC2, Parcial1)
            const evalFolders = await listFolders(courseFolder.id);
            console.log(`  Found ${evalFolders.length} eval folders in ${courseCode}`);

            for (const evalFolder of evalFolders) {
                const evalLabel = evalFolder.name;
                // console.log(`    Processing Eval: ${evalLabel}`);

                // PDF Files (e.g., 2024-II.pdf)
                const pdfFiles = await listPdfFiles(evalFolder.id);
                console.log(`    Found ${pdfFiles.length} PDFs in ${evalLabel}`);

                for (const pdfFile of pdfFiles) {
                    const term = pdfFile.name.replace(/\.pdf$/i, '');
                    const examStoragePath = `${courseCode}/${evalLabel}/${pdfFile.name}`;

                    // Check if exists in DB
                    const { data: existing } = await supabase
                        .from('sheets')
                        .select('id')
                        .eq('exam_storage_path', examStoragePath)
                        .maybeSingle();

                    if (existing) {
                        console.log(`[SKIP] Already exists: ${examStoragePath}`);
                        continue;
                    }

                    console.log(`[NEW] Processing: ${examStoragePath}`);

                    try {
                        const localFilePath = path.join(tmpDir, pdfFile.name);

                        // 1. Download from Drive
                        // console.log(`  Downloading from Drive...`);
                        await downloadFile(pdfFile.id, localFilePath);

                        // 2. Upload to Supabase Storage
                        // console.log(`  Uploading to Supabase Storage...`);
                        await uploadToSupabaseStorage(localFilePath, examStoragePath);

                        // 3. Insert into DB
                        // console.log(`  Inserting into DB...`);
                        const { error: insertError } = await supabase
                            .from('sheets')
                            .insert({
                                course_code: courseCode,
                                eval_label: evalLabel,
                                term: term,
                                exam_storage_path: examStoragePath,
                            });

                        if (insertError) throw insertError;

                        console.log(`  ✅ Successfully synced: ${examStoragePath}`);

                        // Cleanup local file
                        if (fs.existsSync(localFilePath)) {
                            fs.unlinkSync(localFilePath);
                        }

                    } catch (err) {
                        console.error(`  ❌ Error processing ${examStoragePath}:`, err);
                    }
                }
            }
        }

    } catch (error) {
        console.error('Fatal Error:', error);
    } finally {
        // Cleanup tmp dir
        if (fs.existsSync(tmpDir)) {
            fs.rmSync(tmpDir, { recursive: true, force: true });
        }
        console.log('--- SYNC COMPLETED ---');
    }
}

main();
