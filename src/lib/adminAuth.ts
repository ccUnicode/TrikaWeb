// Helper to validate admin session from cookie
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
