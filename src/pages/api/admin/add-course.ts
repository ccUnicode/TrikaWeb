export const prerender = false;

import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { validateAdminSession } from '../../../lib/adminAuth';

const normalizeCode = (value: unknown) => String(value ?? '').trim().toUpperCase();
const normalizeName = (value: unknown) => String(value ?? '').trim();

export const POST: APIRoute = async ({ request, cookies }) => {
    try {
        const isValid = await validateAdminSession(cookies);
        if (!isValid) {
            return new Response(JSON.stringify({ ok: false, error: 'Sesión inválida' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        let body: any;
        try {
            body = await request.json();
        } catch {
            return new Response(JSON.stringify({ ok: false, error: 'Body JSON inválido' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const code = normalizeCode(body.code);
        const name = normalizeName(body.name);

        if (!code || code.length < 2) {
            return new Response(JSON.stringify({ ok: false, error: 'El código es requerido (mínimo 2 caracteres)' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        if (!name || name.length < 2) {
            return new Response(JSON.stringify({ ok: false, error: 'El nombre es requerido (mínimo 2 caracteres)' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const { data: existing, error: existingError } = await supabaseAdmin
            .from('courses')
            .select('id')
            .eq('code', code)
            .maybeSingle();

        if (existingError) {
            console.error('Error checking existing course:', existingError);
            return new Response(JSON.stringify({ ok: false, error: 'Error al validar curso existente' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        if (existing) {
            return new Response(JSON.stringify({ ok: false, error: 'Ya existe un curso con ese código' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const { data: course, error: insertError } = await supabaseAdmin
            .from('courses')
            .insert({ code, name, is_hidden: false })
            .select('id, code, name, is_hidden')
            .single();

        if (insertError || !course) {
            console.error('Error inserting course:', insertError);
            return new Response(JSON.stringify({ ok: false, error: 'Error al crear curso' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        return new Response(JSON.stringify({ ok: true, course: { ...course, is_hidden: course.is_hidden ?? false } }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (err) {
        console.error('add-course API error:', err);
        return new Response(JSON.stringify({ ok: false, error: 'Error interno del servidor' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
};
