export const prerender = false;

import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { validateAdminSession } from '../../../lib/adminAuth';

export const POST: APIRoute = async ({ request, cookies }) => {
    try {
        const isValid = await validateAdminSession(cookies);
        if (!isValid) {
            return new Response(JSON.stringify({ ok: false, error: 'Sesión inválida' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const body = await request.json();
        const { sheet_id, target = 'row' } = body;

        const id = Number(sheet_id);
        if (!Number.isFinite(id) || id <= 0) {
            return new Response(JSON.stringify({ ok: false, error: 'ID de plancha inválido' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        if (!['exam', 'solution', 'row'].includes(target)) {
            return new Response(JSON.stringify({ ok: false, error: 'target inválido' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // Obtain current storage paths before any mutation
        const { data: sheet, error: fetchError } = await supabaseAdmin
            .from('sheets')
            .select('exam_storage_path, solution_storage_path, thumb_storage_path')
            .eq('id', id)
            .single();

        if (fetchError || !sheet) {
            return new Response(JSON.stringify({ ok: false, error: 'La plancha no existe o ya fue eliminada' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // ── RF-33: Delete only the exam (plancha) ────────────────────────
        if (target === 'exam') {
            const storageOps = [];
            if (sheet.exam_storage_path) {
                storageOps.push(supabaseAdmin.storage.from('exams').remove([sheet.exam_storage_path]));
            }
            if (sheet.thumb_storage_path) {
                storageOps.push(supabaseAdmin.storage.from('thumbnails').remove([sheet.thumb_storage_path]));
            }
            await Promise.allSettled(storageOps);

            // If solution also gone → delete the whole row; otherwise just nullify exam fields
            if (!sheet.solution_storage_path) {
                const { error } = await supabaseAdmin.from('sheets').delete().eq('id', id);
                if (error) throw error;
            } else {
                const { error } = await supabaseAdmin
                    .from('sheets')
                    .update({ exam_storage_path: null, thumb_storage_path: null })
                    .eq('id', id);
                if (error) throw error;
            }

            return new Response(JSON.stringify({ ok: true, deleted: 'exam' }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // ── RF-34: Delete only the solution (solucionario) ───────────────
        if (target === 'solution') {
            if (sheet.solution_storage_path) {
                await supabaseAdmin.storage.from('solutions').remove([sheet.solution_storage_path]);
            }

            // If exam also gone → delete the whole row; otherwise nullify solution fields
            if (!sheet.exam_storage_path) {
                const { error } = await supabaseAdmin.from('sheets').delete().eq('id', id);
                if (error) throw error;
            } else {
                const { error } = await supabaseAdmin
                    .from('sheets')
                    .update({ solution_storage_path: null, solution_kind: null })
                    .eq('id', id);
                if (error) throw error;
            }

            return new Response(JSON.stringify({ ok: true, deleted: 'solution' }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // ── target === 'row': Delete the entire row + all storage files ───
        const { error: deleteError } = await supabaseAdmin.from('sheets').delete().eq('id', id);
        if (deleteError) throw deleteError;

        const storageOps = [];
        if (sheet.exam_storage_path) {
            storageOps.push(supabaseAdmin.storage.from('exams').remove([sheet.exam_storage_path]));
        }
        if (sheet.solution_storage_path) {
            storageOps.push(supabaseAdmin.storage.from('solutions').remove([sheet.solution_storage_path]));
        }
        if (sheet.thumb_storage_path) {
            storageOps.push(supabaseAdmin.storage.from('thumbnails').remove([sheet.thumb_storage_path]));
        }
        await Promise.allSettled(storageOps);

        return new Response(JSON.stringify({ ok: true, deleted: 'row' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });

    } catch (err) {
        console.error('delete-sheet API error:', err);
        return new Response(JSON.stringify({ ok: false, error: 'Error interno del servidor' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
};
