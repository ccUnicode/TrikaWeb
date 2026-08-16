import { test, expect } from '@playwright/test';

test.describe('RF-30: Dropdown dinámico de cursos y profesores', () => {
  test('debe mostrar los cursos, seleccionar uno y cargar los profesores correctamente, resolviendo condiciones de carrera', async ({ page }) => {
    // 1. Interceptar peticiones de cursos para devolver mock
    await page.route('**/api/admin/course-options', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          courses: [
            { code: 'BMA01', name: 'Cálculo I' },
            { code: 'FIS01', name: 'Física I' }
          ]
        })
      });
    });

    // 2. Interceptar profesores del primer curso (lento)
    await page.route('**/api/cursos/BMA01/profesores*', async (route) => {
      // Retrasar intencionalmente la respuesta para simular latencia de red
      setTimeout(async () => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ok: true,
            profesores: [{ id: 1, full_name: 'Profesor de BMA01 (LENTO)' }]
          })
        });
      }, 1500);
    });

    // 3. Interceptar profesores del segundo curso (rápido)
    await page.route('**/api/cursos/FIS01/profesores*', async (route) => {
      // Respuesta muy rápida
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          profesores: [{ id: 2, full_name: 'Profesor de FIS01 (RÁPIDO)' }]
        })
      });
    });

    // 4. Ir a la página fixture
    await page.goto('/tests/rf30-fixture');

    const courseSearch = page.locator('#course-search');
    const courseDropdown = page.locator('#course-dropdown');
    const teacherSearch = page.locator('#teacher-search');
    const teacherDropdown = page.locator('#teacher-dropdown');

    // Comprobar estado inicial
    await expect(teacherSearch).toBeDisabled();

    // 5. Interactuar y buscar un curso
    await courseSearch.click();
    await courseSearch.fill('BMA01');
    
    // Seleccionar el primer curso (dispara la petición lenta)
    await courseDropdown.locator('li', { hasText: 'BMA01 - Cálculo I' }).click();

    // Debería estar cargando profesores (disabled)
    await expect(teacherSearch).toBeDisabled();
    await expect(teacherSearch).toHaveAttribute('placeholder', 'Cargando profesores...');

    // Inmediatamente buscar y seleccionar el SEGUNDO curso
    await courseSearch.click();
    await courseSearch.fill('FIS');
    await courseDropdown.locator('li', { hasText: 'FIS01 - Física I' }).click();

    // 6. Verificar condición de carrera
    // El segundo curso carga rápido, así que debería habilitarse pronto
    await expect(teacherSearch).toBeEnabled();
    
    // Y el dropdown debería contener al profesor rápido
    await expect(teacherDropdown.locator('li', { hasText: 'Profesor de FIS01 (RÁPIDO)' })).toBeAttached();

    // Ahora esperamos 2 segundos (tiempo suficiente para que la primera petición lenta termine)
    await page.waitForTimeout(2000);

    // Verificamos que el dropdown NO haya sido sobreescrito por la respuesta lenta de BMA01
    await expect(teacherDropdown.locator('li', { hasText: 'Profesor de FIS01 (RÁPIDO)' })).toBeAttached();
    const slowTeacher = teacherDropdown.locator('li', { hasText: 'Profesor de BMA01 (LENTO)' });
    await expect(slowTeacher).not.toBeAttached();
  });

  test('editar el texto sin seleccionar otro curso debe cancelar la petición pendiente', async ({ page }) => {
    // 1. Mock de cursos
    await page.route('**/api/admin/course-options', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          courses: [
            { code: 'BMA01', name: 'Cálculo I' },
            { code: 'FIS01', name: 'Física I' }
          ]
        })
      });
    });

    // 2. Mock de profesores con retraso largo
    await page.route('**/api/cursos/BMA01/profesores*', async (route) => {
      setTimeout(async () => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ok: true,
            profesores: [{ id: 1, full_name: 'Profesor Fantasma' }]
          })
        });
      }, 2000);
    });

    await page.goto('/tests/rf30-fixture');

    const courseSearch = page.locator('#course-search');
    const courseDropdown = page.locator('#course-dropdown');
    const teacherSearch = page.locator('#teacher-search');
    const teacherDropdown = page.locator('#teacher-dropdown');

    // Seleccionar un curso (dispara la petición lenta)
    await courseSearch.click();
    await courseSearch.fill('BMA01');
    await courseDropdown.locator('li', { hasText: 'BMA01 - Cálculo I' }).click();
    await expect(teacherSearch).toBeDisabled();
    await expect(teacherSearch).toHaveAttribute('placeholder', 'Cargando profesores...');

    // El usuario edita el texto SIN seleccionar otro curso → resetTeacherDropdown() se dispara
    await courseSearch.click();
    await courseSearch.fill('xyz');

    // El selector debe estar limpio y deshabilitado
    await expect(teacherSearch).toBeDisabled();
    await expect(teacherSearch).toHaveAttribute('placeholder', 'Ingresa un curso primero');

    // Esperamos a que la petición lenta hubiera terminado
    await page.waitForTimeout(2500);

    // Verificamos que el selector NO fue sobreescrito por la respuesta tardía
    await expect(teacherSearch).toBeDisabled();
    await expect(teacherSearch).toHaveAttribute('placeholder', 'Ingresa un curso primero');
    const phantom = teacherDropdown.locator('li', { hasText: 'Profesor Fantasma' });
    await expect(phantom).not.toBeAttached();
  });
});
