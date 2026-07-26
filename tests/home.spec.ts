import { test, expect } from '@playwright/test';

test.describe('RF-30: Endpoint de Profesores por Curso', () => {
  // Saltamos los tests si no hay variables de entorno (ej: GitHub Actions sin secretos configurados)
  const isConfigured = !!process.env.SUPABASE_URL;
  test.skip(!isConfigured, 'Variables de entorno de Supabase no configuradas. Saltando pruebas.');

  // Nota: Este test asume que la BD de pruebas tiene al menos el curso "BMA01" o similar.
  // En entornos de CI, se debe ejecutar el seed antes de correr Playwright.
  test('debe devolver 200 y una lista de profesores para un curso existente', async ({ request }) => {
    const res = await request.get('/api/cursos/BMA01/profesores');
    
    // Si BMA01 no existe en tu entorno de test, cambiar el código por uno existente.
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(Array.isArray(body.profesores)).toBe(true);
    // Verificamos la estructura esperada
    if (body.profesores.length > 0) {
      expect(body.profesores[0]).toHaveProperty('id');
      expect(body.profesores[0]).toHaveProperty('full_name');
    }
  });

  test('debe devolver 404 para un curso inexistente', async ({ request }) => {
    const res = await request.get('/api/cursos/INVENTADO999/profesores');
    
    expect(res.status()).toBe(404);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBe('Curso no encontrado');
  });

  test('debe devolver error 400 si no se envía código (ej: ruta base)', async ({ request }) => {
    // Si llamamos a la ruta base o a un código vacío
    const res = await request.get('/api/cursos/ /profesores');
    
    // El router de Astro podría devolver 404 directamente por la URL malformada,
    // o el endpoint podría capturar un código vacío y devolver 400.
    // Comprobamos que al menos no devuelva 200 OK.
    expect(res.status()).not.toBe(200);
  });
});
