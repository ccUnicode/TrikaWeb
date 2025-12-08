import { defineMiddleware } from "astro:middleware";

export const onRequest = defineMiddleware(async (context, next) => {
    const { request, cookies, redirect } = context;
    const url = new URL(request.url);

    // Protected route logic
    if (url.pathname.startsWith("/admin") && !url.pathname.startsWith("/admin/login")) {
        const adminSession = cookies.get("admin_session");

        if (!adminSession || !adminSession.value) {
            return redirect("/admin/login");
        }
    }

    return next();
});
