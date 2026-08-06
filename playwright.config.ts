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
  // Levantamos el servidor siempre para pruebas E2E UI. Si no hay credenciales, inyectamos unas falsas.
  webServer: {
    command: process.env.SUPABASE_URL 
      ? 'npm run dev' 
      : 'npx cross-env SUPABASE_URL=http://localhost:54321 SUPABASE_ANON_KEY=dummy SUPABASE_SERVICE_KEY=dummy npm run dev',
    url: 'http://localhost:4321',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
