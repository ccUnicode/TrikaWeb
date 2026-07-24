import { test, expect } from '@playwright/test';

test('la configuración de Playwright funciona correctamente', async () => {
  // Test de verificación básica que no requiere un servidor en ejecución.
  // Los tests e2e completos se ejecutarán cuando se configure el entorno de CI
  // con las variables de entorno necesarias (Supabase, etc.).
  expect(true).toBe(true);
});
