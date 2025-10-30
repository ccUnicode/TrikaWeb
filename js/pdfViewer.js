// PDFViewer.js

// 1. RUTA CRÍTICA: La ruta solicitada por el servidor (Live Server)
// Se asume que el PDF está en /public/pdfs/ y que la raíz del servidor es la carpeta principal.
// La ruta más probable que funciona con Live Server es la siguiente:
const url = "/public/pdfs/plancha1.pdf"; 

document.addEventListener("DOMContentLoaded", function() {
    
    // Verificación de existencia de la librería (aunque ya está en el HTML)
    if (typeof pdfjsLib === 'undefined') {
        console.error("La librería pdf.js no está cargada. Verifica el script en el HTML.");
        return;
    }
    
    // 2. CONFIGURACIÓN CRÍTICA DEL WORKER
    // Esencial para que PDF.js pueda procesar el documento sin problemas de seguridad (CORS).
    // La URL del worker debe coincidir con la versión de pdf.min.js que usas.
    pdfjsLib.GlobalWorkerOptions.workerSrc = 
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.10.377/pdf.worker.min.js';

    
    // 3. Obtener el documento PDF
    pdfjsLib.getDocument({ url: url }).promise.then(function(pdf) {
        
        // Renderizar la primera página (página 1)
        pdf.getPage(1).then(function(page) {
            
            const scale = 1.5;
            const viewport = page.getViewport({ scale: scale });

            const canvas = document.getElementById('pdf-canvas');
            
            // Verificación del canvas
            if (!canvas) {
                console.error("CRÍTICO: No se encontró el elemento con id='pdf-canvas'. Verifica tu PDFViewerPage.html.");
                return;
            }

            const context = canvas.getContext('2d');

            // Ajustar las dimensiones del canvas al viewport del PDF
            canvas.height = viewport.height;
            canvas.width = viewport.width;

            // 4. Renderizar la página en el canvas
            page.render({
                canvasContext: context,
                viewport: viewport
            });
            
        });
        
    }).catch(function(error) {
        console.error("🛑 Error al cargar o renderizar el PDF. Razón probable: La URL del archivo es incorrecta en el servidor.", error);
    });
});

// Descarga el PDF al hacer clic en el botón
document.getElementById('download-pdf').addEventListener('click', function() {
  const link = document.createElement('a');
  link.href = 'public/pdfs/plancha1.pdf'; // Ruta al PDF
  link.download = 'plancha1.pdf';
  link.click();
});

// Mostrar el solucionario (puedes abrir un PDF diferente o mostrar contenido)
document.getElementById('view-solution').addEventListener('click', function() {
  alert('Este es el solucionario');
});
