import { test, expect } from '@playwright/test';

test.describe('RF-30: Dropdown dinámico de cursos y profesores', () => {
  test('debe mostrar los cursos, seleccionar uno y cargar los profesores correctamente, resolviendo condiciones de carrera', async ({ page }) => {
    // 1. Interceptar peticiones de cursos para devolver mock
    await page.route('/api/admin/course-options', async (route) => {
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
    await page.route('/api/cursos/BMA01/profesores', async (route) => {
      // Retrasar intencionalmente la respuesta para simular latencia de red
      await new Promise(resolve => setTimeout(resolve, 1500));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          profesores: [{ id: 1, full_name: 'Profesor de BMA01 (LENTO)' }]
        })
      });
    });

    // 3. Interceptar profesores del segundo curso (rápido)
    await page.route('/api/cursos/FIS01/profesores', async (route) => {
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
    const teacherSelect = page.locator('#teacher-select');

    // Comprobar estado inicial
    await expect(teacherSelect).toBeDisabled();

    // 5. Interactuar y buscar un curso
    await courseSearch.click();
    await courseSearch.fill('BMA01');
    
    // Seleccionar el primer curso (dispara la petición lenta)
    await courseDropdown.locator('li', { hasText: 'BMA01 - Cálculo I' }).click();

    // Debería estar cargando profesores (disabled)
    await expect(teacherSelect).toBeDisabled();

    // Inmediatamente buscar y seleccionar el SEGUNDO curso
    await courseSearch.click();
    await courseSearch.fill('FIS');
    await courseDropdown.locator('li', { hasText: 'FIS01 - Física I' }).click();

    // 6. Verificar condición de carrera
    // El segundo curso carga rápido, así que debería llenarse pronto con el profesor de Física
    await expect(teacherSelect).toBeEnabled();
    const selectTextFast = await teacherSelect.innerText();
    expect(selectTextFast).toContain('Profesor de FIS01 (RÁPIDO)');

    // Ahora esperamos 2 segundos (tiempo suficiente para que la primera petición lenta termine)
    await page.waitForTimeout(2000);

    // Verificamos que el select NO haya sido sobreescrito por la respuesta lenta de BMA01
    const finalSelectText = await teacherSelect.innerText();
    expect(finalSelectText).toContain('Profesor de FIS01 (RÁPIDO)');
    expect(finalSelectText).not.toContain('Profesor de BMA01 (LENTO)');
  });
});

