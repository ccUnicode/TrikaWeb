import type { APIContext } from 'astro';
import { supabaseClient } from '../lib/supabase.client';

export const prerender = false;

export async function GET(context: APIContext): Promise<Response> {
    const site = 'https://trikaweb.ccunicode.org';

    // Static pages
    const staticPages = [
        { loc: `${site}/`, priority: '1.0', changefreq: 'daily' },
        { loc: `${site}/cursos`, priority: '0.9', changefreq: 'weekly' },
        { loc: `${site}/profesores`, priority: '0.9', changefreq: 'weekly' },
    ];

    // Get all courses
    const { data: courses } = await supabaseClient
        .from('courses')
        .select('code')
        .order('code');

    const coursePages = (courses || []).map((course: { code: string }) => ({
        loc: `${site}/curso/${course.code}`,
        priority: '0.8',
        changefreq: 'weekly',
    }));

    // Get all visible teachers
    const { data: teachers } = await supabaseClient
        .from('teachers')
        .select('id')
        .eq('is_hidden', false)
        .order('id');

    const teacherPages = (teachers || []).map((teacher: { id: number }) => ({
        loc: `${site}/profesores/${teacher.id}`,
        priority: '0.7',
        changefreq: 'weekly',
    }));

    // Combine all pages
    const allPages = [...staticPages, ...coursePages, ...teacherPages];

    // Generate XML
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allPages.map(page => `  <url>
    <loc>${page.loc}</loc>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`).join('\n')}
</urlset>`;

    return new Response(xml, {
        status: 200,
        headers: {
            'Content-Type': 'application/xml; charset=utf-8',
            'Cache-Control': 'public, max-age=3600, s-maxage=3600',
        },
    });
}
