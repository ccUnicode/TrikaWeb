export const prerender = false;
import type { APIRoute } from "astro";
import { getSheetsByIds } from "../../../lib/data";

export const POST: APIRoute = async ({ request }) => {
    try {
        const body = await request.json();
        const { ids } = body;

        if (!Array.isArray(ids)) {
            return new Response(JSON.stringify({ error: "Invalid IDs" }), { status: 400 });
        }

        if (ids.length === 0) {
            return new Response(JSON.stringify([]), { status: 200 });
        }

        const sheets = await getSheetsByIds(ids);
        return new Response(JSON.stringify(sheets), { status: 200 });
    } catch (e) {
        console.error(e);
        return new Response(JSON.stringify({ error: "Server error" }), { status: 500 });
    }
};
