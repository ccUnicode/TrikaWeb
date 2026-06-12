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
        const { sheet_id } = body;

        const id = Number(sheet_id);
        if (!Number.isFinite(id) || id <= 0) {
            return new Response(JSON.stringify({ ok: false, error: 'ID de plancha inválido' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // Obtener los paths de almacenamiento antes de borrar el registro
        const { data: sheetData, error: fetchError } = await supabaseAdmin
            .from('sheets')
            .select('exam_storage_path, solution_storage_path, thumb_storage_path')
            .eq('id', id)
            .single();

        if (fetchError || !sheetData) {
            console.error('Error fetching sheet data for deletion:', fetchError);
            return new Response(JSON.stringify({ ok: false, error: 'La plancha no existe o ya fue eliminada' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // Eliminar de la base de datos
        const { error } = await supabaseAdmin.from('sheets').delete().eq('id', id);

        if (error) {
            console.error('Error deleting sheet from DB:', error);
            return new Response(JSON.stringify({ ok: false, error: 'Error al eliminar registro de plancha' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // Limpiar los archivos en Supabase Storage
        const storagePromises = [];
        if (sheetData.exam_storage_path) {
            storagePromises.push(supabaseAdmin.storage.from('exams').remove([sheetData.exam_storage_path]));
        }
        if (sheetData.solution_storage_path) {
            storagePromises.push(supabaseAdmin.storage.from('solutions').remove([sheetData.solution_storage_path]));
        }
        if (sheetData.thumb_storage_path) {
            storagePromises.push(supabaseAdmin.storage.from('thumbnails').remove([sheetData.thumb_storage_path]));
        }
        await Promise.allSettled(storagePromises);

        const { count: visibleCount } = await supabaseAdmin
            .from('sheets')
            .select('id', { count: 'exact', head: true })
            .eq('is_hidden', false);
        const { count: hiddenCount } = await supabaseAdmin
            .from('sheets')
            .select('id', { count: 'exact', head: true })
            .eq('is_hidden', true);

        return new Response(
            JSON.stringify({
                ok: true,
                counts: { visible: visibleCount ?? 0, hidden: hiddenCount ?? 0 },
            }),
            {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
            }
        );
    } catch (err) {
        console.error('delete-sheet API error:', err);
        return new Response(JSON.stringify({ ok: false, error: 'Error interno del servidor' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
};
