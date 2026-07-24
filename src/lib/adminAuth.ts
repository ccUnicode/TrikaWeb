import { supabaseClient } from './supabase.client';

/**
 * Verifica que la cookie admin_session contenga un token de Supabase Auth válido.
 * Se usa en todos los endpoints de administración para autorizar la solicitud.
 */
export async function validateAdminSession(cookies: any): Promise<boolean> {
    const adminSession = cookies.get('admin_session');
    if (!adminSession?.value) {
        return false;
    }

    try {
        // Verify the token is valid with Supabase
        const { data, error } = await supabaseClient.auth.getUser(adminSession.value);
        return !error && !!data.user;
    } catch {
        return false;
    }
}
