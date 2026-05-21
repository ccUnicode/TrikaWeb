export const prerender = false;

import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { validateAdminSession } from '../../../lib/adminAuth';

const STORAGE_CHUNK = 500;

async function removePaths(bucket: string, paths: string[]) {
    const unique = [...new Set(paths.filter(Boolean))];
    for (let i = 0; i < unique.length; i += STORAGE_CHUNK) {
        const slice = unique.slice(i, i + STORAGE_CHUNK);
        await supabaseAdmin.storage.from(bucket).remove(slice);
    }
}

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
        const { course_id } = body;

        const id = Number(course_id);
        if (!Number.isFinite(id) || id <= 0) {
            return new Response(JSON.stringify({ ok: false, error: 'ID de curso inválido' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const { data: sheets, error: sheetsError } = await supabaseAdmin
            .from('sheets')
            .select('exam_storage_path, solution_storage_path, thumb_storage_path')
            .eq('course_id', id);

        if (sheetsError) {
            console.error('Error listing sheets for course deletion:', sheetsError);
            return new Response(JSON.stringify({ ok: false, error: 'No se pudo preparar la eliminación del curso' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const examPaths: string[] = [];
        const solutionPaths: string[] = [];
        const thumbPaths: string[] = [];

        for (const row of sheets || []) {
            if (row.exam_storage_path) examPaths.push(row.exam_storage_path);
            if (row.solution_storage_path) solutionPaths.push(row.solution_storage_path);
            if (row.thumb_storage_path) thumbPaths.push(row.thumb_storage_path);
        }

        const { error } = await supabaseAdmin.from('courses').delete().eq('id', id);

        if (error) {
            console.error('Error deleting course:', error);
            return new Response(JSON.stringify({ ok: false, error: 'Error al eliminar el curso' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // Tras cascade en BD, limpiar Storage (si el delete de BD falla, no tocamos archivos).
        const storageJobs: Promise<unknown>[] = [];
        if (examPaths.length) storageJobs.push(removePaths('exams', examPaths));
        if (solutionPaths.length) storageJobs.push(removePaths('solutions', solutionPaths));
        if (thumbPaths.length) storageJobs.push(removePaths('thumbnails', thumbPaths));
        await Promise.allSettled(storageJobs);

        const { count: visibleCount } = await supabaseAdmin
            .from('courses')
            .select('id', { count: 'exact', head: true })
            .eq('is_hidden', false);
        const { count: hiddenCount } = await supabaseAdmin
            .from('courses')
            .select('id', { count: 'exact', head: true })
            .eq('is_hidden', true);

        return new Response(JSON.stringify({
            ok: true,
            counts: { visible: visibleCount ?? 0, hidden: hiddenCount ?? 0 },
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (err) {
        console.error('delete-course API error:', err);
        return new Response(JSON.stringify({ ok: false, error: 'Error interno del servidor' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
};
