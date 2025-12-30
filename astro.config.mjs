import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://trikaweb.ccunicode.org',
  output: 'server',
  adapter: vercel(),
  trailingSlash: 'never',
  integrations: [
    sitemap({
      entryLimit: 45000,
      filter: (page) =>
        !page.includes('/admin/') &&
        !page.includes('/saved') &&
        !page.includes('/api/'),
      customPages: [
        'https://trikaweb.ccunicode.org/',
        'https://trikaweb.ccunicode.org/cursos',
        'https://trikaweb.ccunicode.org/profesores',
      ],
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
});