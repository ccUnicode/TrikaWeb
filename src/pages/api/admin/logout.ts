import type { APIRoute } from "astro";

export const POST: APIRoute = async ({ redirect, cookies }) => {
    cookies.delete("admin_session", {
        path: "/",
    });

    return redirect("/admin/login");
};
