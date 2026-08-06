# ADR-003: Uso de Tailwind CSS para el sistema de estilos

## Estado
Aprobada

## Contexto
El proyecto TrikaWeb requiere una forma ágil, escalable y consistente para aplicar estilos a la interfaz de usuario. Al crecer la aplicación, el uso de hojas de estilo tradicionales (CSS o SCSS) puede llevar a conflictos en los nombres de las clases, código no utilizado (dead code) y tiempos de desarrollo más lentos debido al cambio de contexto constante entre archivos HTML/Astro y CSS.

## Alternativas consideradas
* **CSS Puro / SCSS**: Mayor control, pero propenso a problemas de escalabilidad y mantenimiento a largo plazo si no se usa una metodología estricta (como BEM).
* **CSS Modules**: Evita los conflictos de nombres de clases, pero aún requiere la escritura manual de mucho código CSS y constante cambio de archivos.
* **Componentes pre-estilizados (Bootstrap / Material UI)**: Desarrollo muy rápido, pero es difícil personalizarlos a fondo para obtener un diseño único, resultando en aplicaciones que lucen genéricas.
* **Tailwind CSS**: Framework de utilidades CSS. Permite construir diseños complejos directamente en el markup sin abandonar el archivo del componente.

## Decisión
Se decidió utilizar **Tailwind CSS** como el framework principal para los estilos de la aplicación.

## Consecuencias
* **Positivas**: 
  - Aceleración significativa del desarrollo de la interfaz de usuario.
  - Consistencia en el diseño al usar tokens y escalas predefinidas.
  - El archivo CSS de producción será extremadamente pequeño, ya que Tailwind elimina automáticamente todas las clases no utilizadas en el proceso de compilación (purging).
* **Negativas**: 
  - Curva de aprendizaje inicial para memorizar las clases de utilidad.
  - El código HTML/Astro puede volverse visualmente sobrecargado (HTML verboso) si hay demasiadas clases en un solo elemento, aunque puede mitigarse agrupando componentes en Astro.
