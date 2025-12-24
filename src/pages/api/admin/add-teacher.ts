export const prerender = false;

import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { validateAdminSession } from '../../../lib/adminAuth';

export const POST: APIRoute = async ({ request, cookies }) => {
    try {
        // Validate session from cookie
        const isValid = await validateAdminSession(cookies);
        if (!isValid) {
            return new Response(
                JSON.stringify({ ok: false, error: 'Sesión inválida' }),
                { status: 401, headers: { 'Content-Type': 'application/json' } }
            );
        }

        const body = await request.json();
        const { full_name, bio = '', course_ids = [] } = body;

        // Validate full_name
        const name = (full_name || '').trim();
        if (!name || name.length < 2) {
            return new Response(
                JSON.stringify({ ok: false, error: 'El nombre es requerido (mínimo 2 caracteres)' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        // Check if teacher already exists
        const { data: existing } = await supabaseAdmin
            .from('teachers')
            .select('id')
            .ilike('full_name', name)
            .maybeSingle();

        if (existing) {
            return new Response(
                JSON.stringify({ ok: false, error: 'Ya existe un profesor con ese nombre' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        // Insert new teacher
        const { data: teacher, error: insertError } = await supabaseAdmin
            .from('teachers')
            .insert({
                full_name: name,
                bio: (bio || '').trim(),
                avg_overall: 0,
                rating_count: 0,
                is_hidden: false,
            })
            .select('id, full_name, bio')
            .single();

        if (insertError || !teacher) {
            console.error('Error inserting teacher:', insertError);
            return new Response(
                JSON.stringify({ ok: false, error: 'Error al crear profesor' }),
                { status: 500, headers: { 'Content-Type': 'application/json' } }
            );
        }

        // Associate with courses if provided
        const validCourseIds = (course_ids || [])
            .map((id: any) => Number(id))
            .filter((id: number) => Number.isFinite(id) && id > 0);

        if (validCourseIds.length > 0) {
            const courseTeachersData = validCourseIds.map((courseId: number) => ({
                course_id: courseId,
                teacher_id: teacher.id,
                modality: 'T', // Default modality
            }));

            const { error: linkError } = await supabaseAdmin
                .from('courses_teachers')
                .insert(courseTeachersData);

            if (linkError) {
                console.error('Error linking courses:', linkError);
                // Don't fail the whole operation, teacher was created
            }
        }

        return new Response(
            JSON.stringify({
                ok: true,
                teacher: {
                    id: teacher.id,
                    full_name: teacher.full_name,
                    bio: teacher.bio,
                },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
    } catch (err) {
        console.error('add-teacher API error:', err);
        return new Response(
            JSON.stringify({ ok: false, error: 'Error interno del servidor' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }
};
