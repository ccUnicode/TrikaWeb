export const prerender = false;
import type { APIRoute } from "astro";
import { searchEntities } from "../../lib/data";

export const GET: APIRoute = async ({ request }) => {
    const url = new URL(request.url);
    const query = url.searchParams.get("query") || "";

    if (!query || query.length < 2) {
        return new Response(JSON.stringify([]), {
            status: 200,
            headers: { "Content-Type": "application/json" },
        });
    }

    try {
        const results = await searchEntities(query, 5);

        // Format for autocomplete
        const suggestions = [
            ...results.courses.map(c => ({
                text: `${c.code} - ${c.name}`,
                type: "curso",
                url: `/curso/${c.code}`
            })),
            ...results.teachers.map(t => ({
                text: t.full_name,
                type: "profesor",
                url: `/profesores/${t.id}`
            })),
            ...results.sheets.map(s => ({
                text: `${s.course_code} ${s.exam_type} ${s.cycle}`,
                type: "plancha",
                url: `/exams/${s.id}`
            }))
        ];

        return new Response(JSON.stringify(suggestions), {
            status: 200,
            headers: { "Content-Type": "application/json" },
        });
    } catch (e) {
        console.error(e);
        return new Response(JSON.stringify({ error: "Search failed" }), { status: 500 });
    }
};
