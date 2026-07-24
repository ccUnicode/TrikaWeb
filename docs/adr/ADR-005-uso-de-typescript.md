# ADR-005: Uso de TypeScript

## Estado
Aprobada

## Contexto
A medida que el proyecto TrikaWeb crece en funcionalidades (rutas de API, consultas a la base de datos, manejo de autenticación), el uso de JavaScript puro puede conducir a errores en tiempo de ejecución debido a variables nulas o propiedades inexistentes. Se necesita una forma de garantizar la integridad de los datos (tipado) desde que salen de la base de datos hasta que se renderizan en el frontend.

## Alternativas consideradas
* **JavaScript (ES6+) puro**: Desarrollo más rápido inicialmente, pero muy propenso a errores silenciosos a medida que la base de código escala.
* **JSDoc con JavaScript**: Mejora la documentación y la inferencia del editor, pero no proporciona un chequeo estricto durante la etapa de compilación.
* **TypeScript**: Un superconjunto tipado de JavaScript que compila a JavaScript puro. Integración nativa con Astro y el ecosistema moderno.

## Decisión
Se eligió **TypeScript** como lenguaje principal de programación para toda la lógica del cliente y el servidor (endpoints de la API) en TrikaWeb.

## Consecuencias
* **Positivas**: 
  - Prevención de errores (bugs) antes de ejecutar el código gracias a la validación estática.
  - Excelente experiencia de desarrollo (DX) y autocompletado avanzado en los editores de código al definir interfaces estrictas para los datos.
  - Facilita el mantenimiento y el entendimiento del código para futuros desarrolladores.
* **Negativas**: 
  - Curva de aprendizaje adicional para manejar tipos genéricos y utilidades avanzadas.
  - Mayor cantidad de código "boilerplate" (interfaces y tipos) y tiempo extra invertido en resolver advertencias o errores del compilador de tipos (TS checker).
