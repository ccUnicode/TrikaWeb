/**
 * Valida la sesión de administrador a partir de la cookie 'admin_session'.
 * Verifica el token contra Supabase Auth.
 */
import { supabaseClient } from './supabase.client';

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
