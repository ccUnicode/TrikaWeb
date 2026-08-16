# ADR-001: Uso de Astro como framework principal

## Estado
Aprobada

## Contexto
El proyecto TrikaWeb necesita un framework moderno para construir una aplicación web rápida, que pueda servir contenido estático pero que al mismo tiempo permita renderizado del lado del servidor (SSR) e interactividad en componentes específicos. La velocidad de carga y el SEO (posicionamiento) son factores importantes.

## Alternativas consideradas
* **Next.js**: Muy popular y potente para SSR, pero puede agregar mucho JavaScript del lado del cliente, incluso para páginas mayormente estáticas, lo que afecta el tiempo de carga inicial.
* **React puro (Vite / CRA)**: Requiere mucho trabajo manual para configurar el enrutamiento (routing) y no está optimizado nativamente para SSR o SEO sin herramientas adicionales.
* **Astro**: Enfocado en contenido, permite usar "Islas de Arquitectura" (renderizando JavaScript solo donde es estrictamente necesario). Soporta SSR y es agnóstico del framework de UI.

## Decisión
Se decidió utilizar **Astro** como el framework principal para el frontend y backend ligero. Se configurará en modo SSR (Server-Side Rendering) para permitir endpoints de API y autenticación dinámica.

## Consecuencias
* **Positivas**: Tiempos de carga ultrarrápidos al enviar HTML puro por defecto y muy poco JS al cliente (Island architecture). Menor curva de aprendizaje debido al enrutamiento basado en archivos sencillo.
* **Negativas**: El ecosistema no es tan maduro y extenso como el de Next.js, lo que puede requerir configuraciones personalizadas para librerías muy específicas.
