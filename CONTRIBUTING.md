# CONTRIBUTING

Este documento define las reglas de colaboración para TrikaWeb.

Su objetivo es mantener un flujo de trabajo consistente, facilitar la revisión de cambios y reducir errores al integrar nuevas funcionalidades, correcciones, documentación o tareas de mantenimiento.

Antes de realizar una contribución, revisa también:

- [`README.md`](./README.md)
- [`docs/onboarding.md`](./docs/onboarding.md)
- [`docs/setup.md`](./docs/setup.md)
- [`docs/arquitectura.md`](./docs/arquitectura.md)
- El estándar de documentación proporcionado por el área de Investigación y Desarrollo

---

## 1. Flujo general de trabajo

El flujo habitual para realizar cambios en TrikaWeb es:

1. Crear una rama desde la rama base correspondiente.
2. Implementar el cambio.
3. Ejecutar las validaciones necesarias.
4. Actualizar la documentación afectada.
5. Crear un Pull Request.
6. Esperar revisión.
7. Corregir observaciones si existen.
8. Hacer merge únicamente cuando el PR esté aprobado.

Cada rama y Pull Request debe representar un único propósito principal.

---

## 2. Issues

Siempre que exista un issue relacionado con el trabajo, debe utilizarse como referencia durante el desarrollo.

Antes de comenzar:

- Leer completamente la descripción.
- Revisar los criterios de aceptación.
- Confirmar si existen dependencias con otros issues.
- Revisar comentarios o decisiones previas.
- Evitar ampliar el alcance sin coordinación.

Si durante el desarrollo se identifica trabajo adicional que no pertenece al alcance original, debe registrarse como un issue separado cuando corresponda.

---

## 3. Convención de ramas

Las ramas deben seguir el formato:

```text
tipo/descripcion-en-kebab-case
```

Tipos recomendados:

| Tipo        | Uso                                                   |
| ----------- | ----------------------------------------------------- |
| `feat/`     | Nueva funcionalidad o mejora funcional.               |
| `fix/`      | Corrección de bug o comportamiento incorrecto.        |
| `refactor/` | Reestructuración sin cambio funcional esperado.       |
| `docs/`     | Cambios exclusivamente de documentación.              |
| `test/`     | Adición o corrección de pruebas.                      |
| `chore/`    | Mantenimiento, configuración, scripts o dependencias. |

Ejemplos:

```text
feat/course-search
fix/course-evaluation-tabs
refactor/auth-session-validation
docs/technical-onboarding
test/sheet-feedback
chore/update-playwright-config
```

Evitar nombres como:

```text
cambios
fixes
rama-diego
prueba
new-feature
```

La descripción debe indicar claramente el propósito de la rama.

### 3.1 Crear una rama

Actualizar primero la rama base:

```bash
git checkout dev
git pull origin dev
```

Crear la nueva rama:

```bash
git checkout -b docs/technical-onboarding
```

Si el equipo utiliza otra rama base para una tarea específica, seguir la indicación del responsable del proyecto.

---

## 4. Convención de commits

Los commits deben seguir Conventional Commits.

Formato:

```text
tipo(alcance opcional): descripción breve
```

Tipos principales:

| Tipo       | Uso                                      |
| ---------- | ---------------------------------------- |
| `feat`     | Nueva funcionalidad.                     |
| `fix`      | Corrección de error.                     |
| `refactor` | Reestructuración sin cambio funcional.   |
| `docs`     | Cambios de documentación.                |
| `test`     | Adición o corrección de pruebas.         |
| `chore`    | Mantenimiento o configuración.           |
| `style`    | Cambios de formato sin modificar lógica. |
| `perf`     | Mejoras de rendimiento.                  |

Ejemplos:

```text
feat: add course search endpoint
fix: correct active evaluation tab
docs: add technical onboarding guide
test: add sheet feedback e2e coverage
refactor: simplify admin session validation
chore: add project validation scripts
```

### 4.1 Commits atómicos

Cada commit debe representar un cambio coherente.

Evitar:

```text
fix: changes
update project
multiple fixes
final changes
```

También debe evitarse agrupar cambios no relacionados dentro del mismo commit.

Por ejemplo, si una tarea incluye:

- agregar un script de testing;
- actualizar documentación;

pueden utilizarse commits separados si ambos cambios tienen sentido de manera independiente:

```text
chore: add e2e test script
docs: update testing instructions
```

---

## 5. Código y nombrado

El código fuente debe escribirse en inglés.

Esto incluye:

- Variables.
- Funciones.
- Clases.
- Métodos.
- Interfaces.
- Tipos.
- Constantes.
- Nombres de archivos de código cuando corresponda.
- Comentarios documentales.

La documentación técnica debe escribirse en español.

Los archivos y carpetas de documentación deben utilizar `kebab-case`, salvo archivos con convenciones ampliamente aceptadas como:

```text
README.md
CONTRIBUTING.md
CHANGELOG.md
```

Ejemplos correctos:

```text
docs/base-de-datos.md
docs/arquitectura.md
docs/onboarding.md
```

---

## 6. Comentarios y documentación dentro del código

No se debe comentar código evidente.

Los comentarios documentales deben utilizarse únicamente cuando aporten contexto que no pueda deducirse fácilmente del código.

En TypeScript se recomienda utilizar TSDoc cuando corresponda.

Es apropiado documentar:

- Reglas de negocio no evidentes.
- Validaciones complejas.
- Algoritmos no triviales.
- Efectos secundarios importantes.
- Workarounds temporales.
- Funciones reutilizables cuyo comportamiento requiera contexto adicional.

No es necesario documentar:

- CRUD simples.
- Getters o funciones autoexplicativas.
- DTOs o interfaces simples.
- Funciones cuyo nombre y tipos ya describen completamente su comportamiento.

---

## 7. Validaciones antes de abrir un Pull Request

Antes de crear un Pull Request, actualizar la rama y verificar que el proyecto funciona correctamente.

### 7.1 Instalar dependencias

Si cambió `package-lock.json` o estás trabajando desde una instalación limpia:

```bash
npm ci
```

### 7.2 Validación estática

```bash
npm run check
```

Debe finalizar sin errores.

### 7.3 Build

```bash
npm run build
```

Debe completarse correctamente.

### 7.4 Pruebas E2E

Cuando el cambio afecte funcionalidades cubiertas por Playwright:

```bash
npm run test:e2e
```

Si es la primera ejecución en la máquina:

```bash
npx playwright install
```

### 7.5 Validaciones específicas

Además de los comandos generales, deben probarse manualmente los flujos afectados por el cambio.

Ejemplos:

- Si se modifica autenticación, probar login y logout.
- Si se modifica una API, validar respuestas exitosas y errores.
- Si se modifica Storage, probar subida y acceso a archivos.
- Si se modifica un formulario, probar estados válidos e inválidos.
- Si se modifica una migración, validar su ejecución en un entorno seguro.

---

## 8. Actualización de documentación

Todo cambio que afecte comportamiento, configuración, estructura o flujo técnico debe revisar si requiere actualización de documentación.

Ejemplos:

| Cambio                                         | Documentación a revisar                              |
| ---------------------------------------------- | ---------------------------------------------------- |
| Nueva variable de entorno                      | `.env.example`, `docs/setup.md`                      |
| Cambio de arquitectura                         | `docs/arquitectura.md`, ADR si aplica                |
| Nuevo endpoint                                 | `docs/api.md`                                        |
| Cambio de autenticación                        | `docs/arquitectura.md`, `docs/api.md`, ADR si aplica |
| Nueva prueba o cambio de estrategia de testing | `docs/testing.md` o documentación equivalente        |
| Cambio de deploy                               | `docs/deploy.md`                                     |
| Cambio de flujo de colaboración                | `CONTRIBUTING.md`                                    |
| Cambio relevante para nuevos integrantes       | `docs/onboarding.md`                                 |

No duplicar información que ya está documentada en otro archivo.

Cuando una información tenga una fuente principal, los demás documentos deben enlazar hacia ella.

---

## 9. Variables de entorno y secretos

Nunca subir al repositorio:

- `.env`
- Tokens.
- Service role keys.
- Claves privadas.
- Credenciales de Google.
- Contraseñas reales.
- Datos sensibles de usuarios.

`.env.example` debe contener únicamente:

- Nombres de variables.
- Valores ficticios.
- Placeholders.
- Comentarios explicativos.

Ejemplo:

```env
SUPABASE_URL=https://example.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
PUBLIC_SUPABASE_URL=https://example.supabase.co
PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

Nunca copiar valores reales de producción en ejemplos o documentación.

---

## 10. Cambios en base de datos

Los cambios de estructura, funciones, triggers, policies o permisos deben realizarse mediante migraciones.

Antes de crear una migración:

1. Revisar las migraciones existentes.
2. Confirmar que el objeto no exista ya.
3. Evaluar dependencias.
4. Considerar datos existentes.
5. Evitar cambios destructivos innecesarios.

Toda migración debe:

- Tener un propósito claro.
- Evitar recrear objetos existentes sin necesidad.
- Mantener compatibilidad con los datos actuales cuando corresponda.
- Aplicar permisos y RLS de forma explícita.
- Incluir backfills antes de restricciones como `NOT NULL` cuando sea necesario.

Antes de ejecutar una migración potencialmente destructiva sobre una base con datos, crear un backup adecuado.

Nunca probar por primera vez una migración destructiva directamente en producción.

---

## 11. Cambios en Supabase Storage

Antes de modificar buckets o policies:

- Revisar si el bucket es público o privado.
- Revisar cómo se generan las URLs.
- Verificar si el acceso se realiza desde cliente o servidor.
- Revisar policies existentes.
- Evitar exponer archivos privados.

Las operaciones que requieren `service_role` deben realizarse exclusivamente desde el servidor.

---

## 12. Pull Requests

Todo Pull Request debe explicar claramente:

- Qué cambia.
- Por qué se realiza.
- Qué partes fueron afectadas.
- Cómo se valida.
- Qué evidencia existe, cuando aplique.

### 12.1 Estructura recomendada

```md
## Summary

Breve explicación del cambio y su propósito.

## Related Issue / Requirement

- Issue: #XX

## What Changed

- Added ...
- Updated ...
- Fixed ...
- Removed ...

## How to Test

1. ...
2. ...
3. ...

## Screenshots / Evidence

Capturas, resultados de pruebas, logs o respuestas de API cuando aplique.

## Notes

Contexto adicional, limitaciones o trabajo pendiente.
```

---

## 13. Evidencia en Pull Requests

Debe incluirse evidencia cuando el cambio tenga un resultado verificable relevante.

Ejemplos:

### Cambios visuales

Incluir capturas o video.

### Endpoints

Incluir:

- request;
- response;
- código HTTP relevante.

### Migraciones

Incluir evidencia de:

- ejecución correcta;
- estructura resultante;
- validaciones posteriores.

No exponer información sensible en capturas o logs.

### Testing

Puede incluirse:

```text
npm run check
✓ passed

npm run build
✓ passed

npm run test:e2e
✓ passed
```

---

## 14. Revisión de Pull Requests

El autor del PR debe responder a las observaciones del revisor.

Cuando una observación sea corregida:

1. Realizar el cambio.
2. Ejecutar nuevamente las validaciones relevantes.
3. Crear un commit coherente.
4. Responder o marcar la conversación como resuelta cuando corresponda.

No resolver comentarios sin haber realizado el cambio o explicado por qué no corresponde hacerlo.

---

## 15. Requisitos antes del merge

Un Pull Request puede considerarse listo para merge cuando:

- [ ] El alcance corresponde al issue.
- [ ] No incluye cambios no relacionados.
- [ ] `npm run check` finaliza correctamente.
- [ ] `npm run build` finaliza correctamente.
- [ ] Las pruebas relacionadas pasan.
- [ ] Los flujos afectados fueron validados.
- [ ] La documentación necesaria fue actualizada.
- [ ] No contiene secretos ni credenciales.
- [ ] El PR tiene una descripción suficiente.
- [ ] El issue relacionado está referenciado.
- [ ] Las observaciones de revisión fueron atendidas.
- [ ] Tiene las aprobaciones requeridas por el equipo.

No hacer merge únicamente porque el código compila.

---

## 16. Dependencias

Para agregar una dependencia:

```bash
npm install nombre-del-paquete
```

Para agregar una dependencia de desarrollo:

```bash
npm install -D nombre-del-paquete
```

Cuando se agregan, eliminan o actualizan dependencias, deben incluirse en el commit correspondiente:

```text
package.json
package-lock.json
```

No modificar manualmente `package-lock.json`.

Para reproducir las dependencias registradas actualmente:

```bash
npm ci
```

---

## 17. Trabajo fuera del alcance

Durante el desarrollo puede encontrarse:

- Código obsoleto.
- Deuda técnica.
- Bugs no relacionados.
- Documentación desactualizada.
- Mejoras posibles.

No es necesario resolverlos dentro del mismo PR.

Si no pertenecen al alcance actual:

1. Registrar el hallazgo.
2. Crear un issue si corresponde.
3. Mantener el PR original enfocado.

Esto facilita revisión, seguimiento y rollback.

---

## 18. Criterio general

Antes de enviar cualquier cambio, pregúntate:

- ¿El cambio tiene un propósito claro?
- ¿Está dentro del alcance del issue?
- ¿Puede otra persona entenderlo?
- ¿Puede otra persona probarlo?
- ¿Actualicé la documentación necesaria?
- ¿Introduje alguna credencial o dato sensible?
- ¿El PR puede revertirse sin arrastrar cambios no relacionados?

Una contribución no está terminada únicamente cuando el código funciona. También debe ser comprensible, verificable y mantenible por el resto del equipo.

Recuerda revisar el estándar de documentación del área para profundizar en detalles o incluir nuevos aspectos de ser necesarios.