import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:4321',
    trace: 'on-first-retry',
  },
  // Levantamos el servidor siempre para pruebas E2E UI.
  // Si no hay credenciales reales, inyectamos valores dummy para que Astro arranque.
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:4321',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
    env: {
      ...process.env,
      SUPABASE_URL: process.env.SUPABASE_URL || 'http://localhost:54321',
      SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY || 'dummy-service-key',
      PUBLIC_SUPABASE_URL: process.env.PUBLIC_SUPABASE_URL || 'http://localhost:54321',
      PUBLIC_SUPABASE_ANON_KEY: process.env.PUBLIC_SUPABASE_ANON_KEY || 'dummy-anon-key',
    },
  },
});
