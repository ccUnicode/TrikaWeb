# ADR-004: Despliegue de la aplicación en Vercel

## Estado
Aprobada

## Contexto
Para que TrikaWeb esté disponible públicamente con un alto rendimiento, necesitamos una plataforma de alojamiento (hosting). La plataforma elegida debe soportar las características de Server-Side Rendering (SSR) de Astro, proporcionar integración continua (CI/CD) directamente desde el repositorio de código y ser lo suficientemente escalable para manejar tráfico concurrente (ej. estudiantes entrando en épocas de exámenes).

## Alternativas consideradas
* **Servidor Privado Virtual (VPS como DigitalOcean o Linode)**: Alto grado de control y bajo costo, pero requiere gestión manual de servidores, certificados SSL, pipelines de despliegue y configuraciones de Nginx/Apache.
* **AWS (EC2, ECS o Amplify)**: Altamente escalable, pero la configuración inicial es compleja y puede generar costos impredecibles si no se gestiona correctamente.
* **Netlify**: Excelente plataforma para sitios estáticos y funciones serverless, muy similar a Vercel.
* **Vercel**: Plataforma optimizada nativamente para frameworks modernos. Ofrece despliegues automáticos (CI/CD) con cero configuración, una red global de entrega de contenido (CDN) rápida y soporte de primera clase para el adaptador SSR de Astro.

## Decisión
Se eligió **Vercel** como la plataforma de infraestructura y despliegue (hosting) para el frontend y los endpoints de la API de TrikaWeb.

## Consecuencias
* **Positivas**: 
  - Despliegues automatizados e inmediatos tras cada `push` a las ramas principales del repositorio (CI/CD sin esfuerzo).
  - Previsualizaciones automáticas por cada Pull Request.
  - Gestión automática de certificados SSL (HTTPS).
  - Rendimiento óptimo en el borde (Edge Network) garantizando tiempos de respuesta bajos.
* **Negativas**: 
  - Mayor dependencia (vendor lock-in) hacia la arquitectura de funciones serverless de Vercel.
  - Si la aplicación crece enormemente y consume demasiadas ejecuciones de funciones o ancho de banda, puede volverse más costoso a largo plazo que mantener servidores propios.
