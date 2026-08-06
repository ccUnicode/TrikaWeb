import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';
import tailwindcss from '@tailwindcss/vite';

import react from '@astrojs/react';

export default defineConfig({
  site: 'https://trikaweb.ccunicode.org',
  output: 'server',
  adapter: vercel(),
  trailingSlash: 'never',
  devToolbar: {
    enabled: false,
  },
  vite: {
    plugins: [tailwindcss()],
  },

  integrations: [react()],
});