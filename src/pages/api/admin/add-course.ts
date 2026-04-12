export const prerender = false;

import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { validateAdminSession } from '../../../lib/adminAuth';

const normalizeCode = (value: unknown) => String(value ?? '').trim().toUpperCase();
const normalizeName = (value: unknown) => String(value ?? '').trim();
const normalizeCredits = (value: unknown) => {
    const num = Number(value);
    return Number.isInteger(num) ? num : NaN;
};
const normalizeId = (value: unknown): number | null => {
    if (value === undefined || value === null || value === '') {
        return null;
    }

    const num = Number(value);

    if (!Number.isInteger(num) || num <= 0) {
        return null;
    }

    return num;
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
        const credits = normalizeCredits(body.credits);
        const system_id = normalizeId(body.system_id);
        const subsystem_id = normalizeId(body.subsystem_id);

        if (system_id === null) {
            return new Response(JSON.stringify({ ok: false, error: 'Sistema inválido' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        if (subsystem_id !== null && subsystem_id <= 0) {
            return new Response(JSON.stringify({ ok: false, error: 'Subsistema inválido' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

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

        if (!Number.isInteger(credits) || credits <= 0) {
            return new Response(JSON.stringify({ 
                ok: false, 
                error: 'Los créditos deben ser un número entero mayor a 0' 
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        if (!Number.isInteger(system_id)) {
            return new Response(JSON.stringify({ ok: false, error: 'Debe seleccionar un sistema de evaluación' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const { data: requiresData, error: requiresError } = await supabaseAdmin.rpc(
            "get_evaluation_systems"
        );

        if (requiresError) {
            console.error(requiresError);
            return new Response(JSON.stringify({ ok: false, error: 'Error validando sistema' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const system = requiresData?.find((s: any) => s.system_id === system_id);

        if (!system) {
            return new Response(JSON.stringify({ ok: false, error: 'Sistema de evaluación inválido' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        if (system.requires_subsystem && !subsystem_id) {
            return new Response(JSON.stringify({ ok: false, error: 'Debe seleccionar un subsistema' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        if (!system.requires_subsystem && subsystem_id) {
            return new Response(JSON.stringify({ ok: false, error: 'Este sistema no admite subsistema' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        if (subsystem_id) {
            const { data: subsystems, error: subError } = await supabaseAdmin.rpc(
                "get_evaluation_subsystems"
            );

            if (subError) {
                console.error(subError);
                return new Response(JSON.stringify({ ok: false, error: 'Error validando subsistema' }), {
                    status: 500,
                    headers: { 'Content-Type': 'application/json' },
                });
            }

            const exists = subsystems?.some((s: any) => s.subsystem_id === subsystem_id);

            if (!exists) {
                return new Response(JSON.stringify({ ok: false, error: 'Subsistema inválido' }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' },
                });
            }
        }

        const { data: result, error: rpcError } = await supabaseAdmin.rpc('create_course', {
            p_code: code,
            p_name: name,
            p_credits: credits,
            p_system_id: system_id,
            p_subsystem_id: subsystem_id,
        });

        if (rpcError) {
            console.error('Error calling create_course:', rpcError);
            return new Response(JSON.stringify({ ok: false, error: 'Error al crear curso' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        if (!result?.ok) {
            return new Response(JSON.stringify({
                ok: false,
                error: result?.error || 'No se pudo crear el curso',
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        return new Response(JSON.stringify({
            ok: true,
            course: result.course,
        }), {
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