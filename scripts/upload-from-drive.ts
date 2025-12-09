
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
const DRIVE_SOLUTIONS_FOLDER_ID = process.env.DRIVE_SOLUTIONS_FOLDER_ID;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

// Parse CLI arguments
const args = process.argv.slice(2);
const typeArg = args.find(arg => arg.startsWith('--type='));
const syncType = typeArg ? typeArg.split('=')[1] : 'all'; // Default to 'all'

if (!['exams', 'solutions', 'all'].includes(syncType)) {
    console.error('Error: Invalid --type argument. Use: exams, solutions, or all');
    process.exit(1);
}

// Validate required env vars based on sync type
const missingVars: string[] = [];
if (!SERVICE_ACCOUNT_PATH) missingVars.push('GOOGLE_APPLICATION_CREDENTIALS');
if (!SUPABASE_URL) missingVars.push('SUPABASE_URL');
if (!SUPABASE_SERVICE_ROLE_KEY) missingVars.push('SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SERVICE_KEY)');

if ((syncType === 'exams' || syncType === 'all') && !DRIVE_EXAMS_FOLDER_ID) {
    missingVars.push('DRIVE_EXAMS_FOLDER_ID');
}
if ((syncType === 'solutions' || syncType === 'all') && !DRIVE_SOLUTIONS_FOLDER_ID) {
    missingVars.push('DRIVE_SOLUTIONS_FOLDER_ID');
}

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

async function listPdfFiles(parentId: string) {
    const pdfs: { id: string; name: string }[] = [];
    let pageToken: string | undefined = undefined;

    do {
        const res: any = await drive.files.list({
            q: `'${parentId}' in parents and trashed = false`,
            fields: 'nextPageToken, files(id, name, mimeType)',
            pageToken,
        });

        const files = res.data.files;
        if (files) {
            files.forEach((file: any) => {
                if (file.id && file.name) {
                    const isPdfMime = file.mimeType.includes('pdf');
                    const isPdfExt = file.name.toLowerCase().endsWith('.pdf');

                    if (isPdfMime || isPdfExt) {
                        pdfs.push({ id: file.id, name: file.name });
                    } else {
                        console.log(`      [IGNORED] ${file.name} (Type: ${file.mimeType})`);
                    }
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
async function uploadToSupabaseStorage(localPath: string, storagePath: string, bucket: string) {
    const fileContent = fs.readFileSync(localPath);
    const { data, error } = await supabase.storage
        .from(bucket)
        .upload(storagePath, fileContent, {
            contentType: 'application/pdf',
            upsert: true
        });

    if (error) throw error;
    return data;
}

/**
 * Fetch all courses and returns a map of Code -> ID
 */
async function getCourseMap() {
    const { data, error } = await supabase
        .from('courses')
        .select('id, code');

    if (error) {
        console.error('Error fetching courses:', error);
        return new Map<string, number>();
    }

    const map = new Map<string, number>();
    if (data) {
        data.forEach((c: any) => {
            if (c.code) map.set(c.code.toUpperCase(), c.id);
        });
    }
    return map;
}

// --- SYNC FUNCTIONS ---

/**
 * Sync exams from Drive to Supabase
 */
async function syncExams(courseMap: Map<string, number>, tmpDir: string) {
    console.log('\n=== SYNCING EXAMS ===');
    console.log(`Exams Folder ID: ${DRIVE_EXAMS_FOLDER_ID}`);

    // Level 1: Course Codes (e.g., BMA01, FIS101)
    console.log('Listing Level 1 folders (Courses)...');
    const courseFolders = await listFolders(DRIVE_EXAMS_FOLDER_ID!);
    console.log(`Found ${courseFolders.length} courses in Drive.`);

    let syncedCount = 0;
    let skippedCount = 0;

    for (const courseFolder of courseFolders) {
        const courseCode = courseFolder.name.toUpperCase();

        // Validate Course Exists in DB
        const courseId = courseMap.get(courseCode);
        if (!courseId) {
            console.warn(`[WARN] Course ${courseCode} not found in DB. Skipping...`);
            continue;
        }

        console.log(`Processing Course: ${courseCode} (ID: ${courseId})`);

        // Level 2: Eval Labels (e.g., PC1, PC2, Parcial1)
        const evalFolders = await listFolders(courseFolder.id);
        console.log(`  Found ${evalFolders.length} eval folders in ${courseCode}`);

        for (const evalFolder of evalFolders) {
            const evalLabel = evalFolder.name;

            // PDF Files (e.g., 2024-II.pdf)
            const pdfFiles = await listPdfFiles(evalFolder.id);
            if (pdfFiles.length > 0) {
                console.log(`    Found ${pdfFiles.length} PDFs in ${evalLabel}`);
            }

            for (const pdfFile of pdfFiles) {
                // Filename is '2024-II.pdf' -> term/cycle is '2024-II'
                const term = pdfFile.name.replace(/\.pdf$/i, '');

                // Supabase Path: BMA02/PC1/2024-II.pdf
                const examStoragePath = `${courseCode}/${evalLabel}/${pdfFile.name}`;

                // Check if exists in DB (sheets table)
                const { data: existing } = await supabase
                    .from('sheets')
                    .select('id')
                    .eq('exam_storage_path', examStoragePath)
                    .maybeSingle();

                if (existing) {
                    console.log(`      [SKIP] Already exists: ${examStoragePath}`);
                    skippedCount++;
                    continue;
                }

                console.log(`      [NEW] Processing: ${examStoragePath}`);

                try {
                    const localFilePath = path.join(tmpDir, pdfFile.name);

                    // 1. Download from Drive
                    await downloadFile(pdfFile.id, localFilePath);

                    // 2. Upload to Supabase Storage
                    await uploadToSupabaseStorage(localFilePath, examStoragePath, 'exams');

                    // 3. Insert into DB
                    const { error: insertError } = await supabase
                        .from('sheets')
                        .insert({
                            course_id: courseId,
                            exam_type: evalLabel,
                            cycle: term,
                            exam_storage_path: examStoragePath,
                            solution_kind: null,
                            solution_storage_path: null,
                        });

                    if (insertError) throw insertError;

                    console.log(`      ✅ Successfully synced: ${examStoragePath}`);
                    syncedCount++;

                    // Cleanup local file
                    if (fs.existsSync(localFilePath)) {
                        fs.unlinkSync(localFilePath);
                    }

                } catch (err) {
                    console.error(`      ❌ Error processing ${examStoragePath}:`, err);
                }
            }
        }
    }

    console.log(`\nExams sync complete: ${syncedCount} new, ${skippedCount} skipped`);
    return { synced: syncedCount, skipped: skippedCount };
}

/**
 * Sync solutions from Drive to Supabase
 */
async function syncSolutions(courseMap: Map<string, number>, tmpDir: string) {
    console.log('\n=== SYNCING SOLUTIONS ===');
    console.log(`Solutions Folder ID: ${DRIVE_SOLUTIONS_FOLDER_ID}`);

    // Level 1: Course Codes (e.g., BMA01, FIS101)
    console.log('Listing Level 1 folders (Courses)...');
    const courseFolders = await listFolders(DRIVE_SOLUTIONS_FOLDER_ID!);
    console.log(`Found ${courseFolders.length} courses in Drive.`);

    let syncedCount = 0;
    let skippedCount = 0;
    let noSheetCount = 0;

    for (const courseFolder of courseFolders) {
        const courseCode = courseFolder.name.toUpperCase();

        // Validate Course Exists in DB
        const courseId = courseMap.get(courseCode);
        if (!courseId) {
            console.warn(`[WARN] Course ${courseCode} not found in DB. Skipping...`);
            continue;
        }

        console.log(`Processing Course: ${courseCode} (ID: ${courseId})`);

        // Level 2: Eval Labels (e.g., PC1, PC2, Parcial1)
        const evalFolders = await listFolders(courseFolder.id);
        console.log(`  Found ${evalFolders.length} eval folders in ${courseCode}`);

        for (const evalFolder of evalFolders) {
            const evalLabel = evalFolder.name;

            // PDF Files (e.g., 2024-II.pdf)
            const pdfFiles = await listPdfFiles(evalFolder.id);
            if (pdfFiles.length > 0) {
                console.log(`    Found ${pdfFiles.length} PDFs in ${evalLabel}`);
            }

            for (const pdfFile of pdfFiles) {
                // Filename is '2024-II.pdf' -> term/cycle is '2024-II'
                const term = pdfFile.name.replace(/\.pdf$/i, '');

                // Supabase Path for solutions: BMA02/PC1/2024-II.pdf
                const solutionStoragePath = `${courseCode}/${evalLabel}/${pdfFile.name}`;

                // Find the corresponding sheet by course_id, exam_type, and cycle
                const { data: existingSheet, error: lookupError } = await supabase
                    .from('sheets')
                    .select('id, solution_storage_path')
                    .eq('course_id', courseId)
                    .eq('exam_type', evalLabel)
                    .eq('cycle', term)
                    .maybeSingle();

                if (lookupError) {
                    console.error(`      ❌ Error looking up sheet:`, lookupError);
                    continue;
                }

                if (!existingSheet) {
                    console.log(`      [NO SHEET] No exam found for: ${courseCode}/${evalLabel}/${term}`);
                    noSheetCount++;
                    continue;
                }

                // Check if solution already exists
                if (existingSheet.solution_storage_path) {
                    console.log(`      [SKIP] Solution already exists: ${solutionStoragePath}`);
                    skippedCount++;
                    continue;
                }

                console.log(`      [NEW] Processing solution: ${solutionStoragePath}`);

                try {
                    const localFilePath = path.join(tmpDir, `sol_${pdfFile.name}`);

                    // 1. Download from Drive
                    await downloadFile(pdfFile.id, localFilePath);

                    // 2. Upload to Supabase Storage (solutions bucket)
                    await uploadToSupabaseStorage(localFilePath, solutionStoragePath, 'solutions');

                    // 3. Update the sheet with solution info
                    const { error: updateError } = await supabase
                        .from('sheets')
                        .update({
                            solution_kind: 'pdf',
                            solution_storage_path: solutionStoragePath,
                        })
                        .eq('id', existingSheet.id);

                    if (updateError) throw updateError;

                    console.log(`      ✅ Successfully synced solution: ${solutionStoragePath}`);
                    syncedCount++;

                    // Cleanup local file
                    if (fs.existsSync(localFilePath)) {
                        fs.unlinkSync(localFilePath);
                    }

                } catch (err) {
                    console.error(`      ❌ Error processing solution ${solutionStoragePath}:`, err);
                }
            }
        }
    }

    console.log(`\nSolutions sync complete: ${syncedCount} new, ${skippedCount} skipped, ${noSheetCount} without matching exam`);
    return { synced: syncedCount, skipped: skippedCount, noSheet: noSheetCount };
}

// --- MAIN LOGIC ---

async function main() {
    console.log('--- STARTING DRIVE TO SUPABASE SYNC ---');
    console.log(`Sync Type: ${syncType}`);

    // Pre-fetch courses to resolve Foreign Keys
    const courseMap = await getCourseMap();
    console.log(`Loaded ${courseMap.size} courses from DB.`);

    const tmpDir = path.join(__dirname, '../tmp-drive');
    if (!fs.existsSync(tmpDir)) {
        fs.mkdirSync(tmpDir, { recursive: true });
    }

    const results: { exams?: any; solutions?: any } = {};

    try {
        if (syncType === 'exams' || syncType === 'all') {
            results.exams = await syncExams(courseMap, tmpDir);
        }

        if (syncType === 'solutions' || syncType === 'all') {
            results.solutions = await syncSolutions(courseMap, tmpDir);
        }

    } catch (error) {
        console.error('Fatal Error:', error);
    } finally {
        // Cleanup tmp dir
        if (fs.existsSync(tmpDir)) {
            fs.rmSync(tmpDir, { recursive: true, force: true });
        }

        console.log('\n--- SYNC COMPLETED ---');
        console.log('Results:', JSON.stringify(results, null, 2));
    }
}

main();
