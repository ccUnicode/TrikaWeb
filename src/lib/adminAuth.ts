import type { AstroCookies } from "astro";
import { supabaseAdmin } from "./supabaseAdmin";

/**
 * Verifica que la cookie admin_session:
 * 1. Contenga un token válido de Supabase Auth.
 * 2. Pertenezca a un usuario autenticado.
 * 3. Pertenezca a un usuario con app_metadata.role = "admin".
 *
 * Esta validación se utiliza en los endpoints administrativos antes
 * de realizar operaciones mediante supabaseAdmin.
 */
export async function validateAdminSession(
  cookies: AstroCookies,
): Promise<boolean> {
  const accessToken = cookies.get("admin_session")?.value?.trim();

  if (!accessToken) {
    return false;
  }

  try {
    const {
      data: { user },
      error,
    } = await supabaseAdmin.auth.getUser(accessToken);

    if (error || !user) {
      return false;
    }

    return user.app_metadata?.role === "admin";
  } catch (error) {
    console.error("Error al validar la sesión administrativa:", error);

    return false;
  }
}
