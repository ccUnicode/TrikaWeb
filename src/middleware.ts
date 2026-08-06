import { defineMiddleware } from "astro:middleware";

/**
 * Middleware que protege las rutas /admin (excepto /admin/login).
 * Verifica la existencia de la cookie admin_session.
 * La validación del token en sí se delega a cada endpoint via validateAdminSession.
 */
export const onRequest = defineMiddleware(async (context, next) => {
    const { request, cookies, redirect } = context;
    const url = new URL(request.url);

    if (url.pathname.startsWith("/admin") && !url.pathname.startsWith("/admin/login")) {
        const adminSession = cookies.get("admin_session");

        if (!adminSession || !adminSession.value) {
            return redirect("/admin/login");
        }
    }

    return next();
});
