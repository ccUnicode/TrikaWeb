import type { APIRoute } from "astro";
import { supabaseClient } from "../../../lib/supabase.client";

export const POST: APIRoute = async ({ request, redirect, cookies }) => {
    try {
        const formData = await request.formData();
        const email = formData.get("email")?.toString();
        const password = formData.get("password")?.toString();

        if (!email || !password) {
            return redirect("/admin/login?error=1");
        }

        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email,
            password,
        });

        if (error || !data.session) {
            return redirect("/admin/login?error=1");
        }

        // Set the cookie
        cookies.set("admin_session", data.session.access_token, {
            path: "/",
            httpOnly: true,
            secure: true,
            sameSite: "strict",
            maxAge: 60 * 60 * 12, // 12 hours
        });

        return redirect("/admin/upload");
    } catch (error) {
        console.error("Login error:", error);
        return redirect("/admin/login?error=1");
    }
};
