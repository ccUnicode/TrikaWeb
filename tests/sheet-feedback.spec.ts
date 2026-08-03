import { test, expect } from '@playwright/test';

test.describe('Sheet Feedback & Rating Flow', () => {
  test('debería mostrar el estado vacío si no hay comentarios', async ({ page }) => {
    // Interceptar llamadas a la API para simular una plancha sin comentarios
    await page.route('/api/sheets/1/feedback*', async route => {
      const json = {
        feedback: [],
        total: 0,
        avgRating: 0,
        page: 1,
        pageSize: 5,
        userFeedback: null
      };
      await route.fulfill({ json });
    });

    // Navegar a la página del solucionario de la plancha
    await page.goto('/exams/1');

    // Clic en "Ver solucionario" para que la sección de comentarios se muestre
    // (según la lógica del cliente, los comentarios solo se ven en modo solucionario)
    const viewSolutionBtn = page.locator('#view-solution-btn');
    if (await viewSolutionBtn.isVisible()) {
      await viewSolutionBtn.click();
    }

    // Comprobar que la sección de comentarios es visible
    const feedbackSection = page.locator('#feedback-section');
    await expect(feedbackSection).toBeVisible();

    // Comprobar que el estado vacío es visible y tiene el texto correcto
    const emptyState = page.locator('#feedback-empty');
    await expect(emptyState).toBeVisible();
    await expect(emptyState).toContainText('Aún no hay comentarios');
    
    // Comprobar que el spinner de carga ya no está visible
    const loadingState = page.locator('#feedback-loading');
    await expect(loadingState).toBeHidden();
  });
});
