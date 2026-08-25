# Onboarding - TrikaWeb

Este documento está dirigido a personas que se incorporan al proyecto TrikaWeb por primera vez.

Su objetivo es ofrecer una ruta inicial para comprender el proyecto, obtener los accesos necesarios, levantar el entorno local, validar que funciona correctamente y realizar una primera contribución siguiendo el flujo de trabajo del equipo.

Este documento no reemplaza la documentación técnica específica. Cuando una tarea requiera mayor detalle, se enlaza al documento correspondiente.

---

## 1. Sobre TrikaWeb

TrikaWeb es una plataforma web orientada a centralizar recursos académicos, específicamente exámenes pasados (planchas) y solucionarios, con la finalidad de facilitar el acceso a estos de forma ordenada, así como información relacionada con cursos, evaluaciones, planchas y docentes.

El proyecto incluye:

- Aplicación web construida con Astro.
- Componentes interactivos con React.
- APIs implementadas mediante rutas de servidor de Astro.
- Base de datos PostgreSQL administrada mediante Supabase.
- Autenticación mediante Supabase Auth.
- Almacenamiento de archivos mediante Supabase Storage.
- Despliegue mediante Vercel.
- Pruebas E2E mediante Playwright.

Para una descripción más general del proyecto, revisar el [`README.md`](../README.md).

Para comprender la estructura y decisiones principales del sistema, revisar [`arquitectura.md`](./arquitectura.md).

---

## 2. Documentación que debes conocer

Antes de comenzar a realizar cambios, familiarízate con los siguientes documentos.

| Documento                                    | Propósito                                                       |
| -------------------------------------------- | --------------------------------------------------------------- |
| [`README.md`](../README.md)                  | Introducción al proyecto, stack y comandos principales.         |
| [`setup.md`](./setup.md)                     | Instalación y configuración detallada del entorno local.        |
| [`arquitectura.md`](./arquitectura.md)       | Estructura general del sistema y componentes principales.       |
| [`api.md`](./api.md)                         | Referencia de las rutas API del proyecto.                       |
| [`funcionalidades.md`](./funcionalidades.md) | Descripción de las funcionalidades actuales.                    |
| [`CONTRIBUTING.md`](../CONTRIBUTING.md)      | Convenciones para ramas, commits, Pull Requests y colaboración. |
| [`deploy.md`](./deploy.md)                   | Proceso de despliegue, validación y rollback.                   |

Si alguno de estos documentos contradice el comportamiento actual del código, prioriza el código como referencia y reporta la inconsistencia mediante un issue o Pull Request de documentación.

---

## 3. Accesos necesarios

Antes de comenzar, verifica que cuentas con los accesos necesarios para trabajar en el proyecto.

Según las responsabilidades asignadas, puedes necesitar acceso a:

- Repositorio de GitHub de TrikaWeb.
- Proyecto de Supabase.
- Proyecto de Vercel.
- Google Drive u otros repositorios de archivos utilizados por el proyecto.

No solicites ni compartas credenciales, tokens o secretos mediante archivos del repositorio, issues, Pull Requests o canales públicos.

Los valores sensibles deben administrarse únicamente mediante los mecanismos definidos por el equipo.

---

## 4. Herramientas requeridas

Para trabajar localmente necesitas, como mínimo:

- Git.
- Node.js `>= 22.12.0`.
- npm.
- Un editor de código, preferentemente Visual Studio Code u otro con soporte para TypeScript y Astro.

Para las pruebas E2E también necesitarás los navegadores administrados por Playwright.

Las versiones y requisitos detallados deben mantenerse actualizados en [`setup.md`](./setup.md) y en `package.json`.

---

## 5. Preparar el entorno local

La instalación completa está documentada en [`setup.md`](./setup.md).

Como ruta general de incorporación, realiza los siguientes pasos.

### 5.1 Clonar el repositorio

```bash
git clone <URL_DEL_REPOSITORIO>
cd TrikaWeb
```

### 5.2 Instalar dependencias

Para una instalación basada en el archivo de bloqueo del proyecto:

```bash
npm ci
```

Si estás trabajando en un contexto donde `npm ci` no puede utilizarse, revisa `setup.md` antes de recurrir a `npm install`.

### 5.3 Configurar variables de entorno

Crea un archivo `.env` tomando `.env.example` como referencia.

En Git Bash, Linux o WSL:

```bash
cp .env.example .env
```

En PowerShell:

```powershell
Copy-Item .env.example .env
```

Completa únicamente los valores necesarios para el entorno local.

### 5.4 Instalar los navegadores de Playwright

La primera vez que trabajes con las pruebas E2E:

```bash
npx playwright install
```

En Linux o entornos CI puede ser necesario:

```bash
npx playwright install --with-deps
```

---

## 6. Validar el entorno

Antes de comenzar una tarea funcional, confirma que el proyecto puede validarse desde tu instalación local.

### 6.1 Validación estática

Ejecuta:

```bash
npm run check
```

Este comando debe finalizar sin errores antes de considerar el entorno correctamente preparado.

### 6.2 Build de producción

Ejecuta:

```bash
npm run build
```

El proceso debe completar correctamente.

### 6.3 Pruebas E2E

Ejecuta:

```bash
npm run test:e2e
```

Playwright utiliza la configuración definida en `playwright.config.ts`.

No es necesario levantar manualmente otro servidor si la configuración de Playwright ya define el servidor de desarrollo requerido.

### 6.4 Ejecutar el proyecto localmente

Finalmente:

```bash
npm run dev
```

Por defecto, Astro utiliza:

```text
http://localhost:4321
```

Verifica que la aplicación cargue correctamente antes de comenzar tu primera contribución.

---

## 7. Cómo está organizado el proyecto

La estructura puede cambiar con el tiempo, por lo que [`arquitectura.md`](./arquitectura.md) debe considerarse la referencia principal.

A nivel general:

```text
TrikaWeb/
├── src/
│   ├── components/
│   ├── layouts/
│   ├── lib/
│   └── pages/
│       ├── admin/
│       ├── api/
│       ├── curso/
│       └── ...
├── supabase/
│   ├── migrations/
│   ├── schema.sql
│   └── seed.sql
├── tests/
├── docs/
├── public/
├── package.json
└── playwright.config.ts
```

### `src/pages/`

Contiene las páginas de Astro y las rutas de API.

Las rutas bajo:

```text
src/pages/api/
```

se convierten en endpoints del servidor.

### `src/lib/`

Contiene utilidades compartidas, configuración y lógica relacionada con autenticación, Supabase y otros servicios comunes.

### `supabase/`

Contiene los archivos relacionados con base de datos, incluyendo migraciones, schema y datos de prueba cuando corresponda.

### `tests/`

Contiene las pruebas automatizadas del proyecto.

### `docs/`

Contiene la documentación técnica que complementa el `README.md`.

---

## 8. Conceptos que debes entender antes de modificar el sistema

No necesitas conocer todo el sistema durante tu primer día, pero sí debes identificar los siguientes componentes.

### 8.1 Astro

Astro funciona como framework principal del proyecto.

El proyecto utiliza tanto páginas como rutas API dentro de la misma aplicación.

### 8.2 React

React se utiliza en componentes que requieren interactividad del lado del cliente. Al momento de la redacción de este documento, son las mallas interactivas de los planes de estudio.

### 8.3 Supabase

Supabase se utiliza para:

- Base de datos PostgreSQL.
- Autenticación.
- Storage.
- Funciones y políticas de acceso relacionadas con datos.

Antes de modificar tablas, policies, autenticación o Storage, revisa la documentación correspondiente y las migraciones existentes.

### 8.4 Autenticación

La autenticación actual de estudiantes utiliza Supabase Auth.

El flujo y las cookies utilizadas deben consultarse en la documentación técnica actual y en el código correspondiente.

### 8.5 Vercel

Vercel se utiliza para el despliegue de la aplicación.

No realices cambios de configuración de producción sin revisar previamente [`deploy.md`](./deploy.md).

---

## 9. Flujo de trabajo esperado

Antes de realizar tu primera contribución, revisa [`CONTRIBUTING.md`](../CONTRIBUTING.md).

El flujo general es el siguiente:

1. Crear una rama específica en base a `dev`
2. Implementar cambios de alcance acotado.
3. Ejecutar las validaciones correspondientes.
4. Actualizar documentación si el cambio lo requiere.
5. Crear un Pull Request.
6. Esperar revisión.
7. Corregir observaciones si existen.
8. Hacer merge cuando el PR esté aprobado.

---

## 10. Ramas

Las ramas deben seguir las convenciones definidas en `CONTRIBUTING.md`.

Ejemplos:

```text
feat/course-search
fix/course-pagination
docs/technical-onboarding
test/auth-coverage
chore/update-dependencies
```

Cada rama debe representar un único propósito.

Evita mezclar funcionalidades, refactors y cambios documentales no relacionados dentro de la misma rama.

Para un mayor detalle, se recomienda revisar el estándar de documentación de los proyectos del área

---

## 11. Commits

Los commits siguen Conventional Commits.

Ejemplos:

```text
feat: add course search endpoint
fix: correct sheet feedback validation
docs: update technical onboarding
test: add feedback E2E coverage
chore: update project scripts
```

Los commits deben ser atómicos y representar cambios coherentes.

---

## 12. Pull Requests

Antes de abrir un Pull Request:

- Ejecuta `npm run check`.
- Ejecuta `npm run build`.
- Ejecuta las pruebas relacionadas con tu cambio.
- Revisa que no hayas incluido secretos o archivos locales.
- Actualiza la documentación afectada.
- Relaciona el PR con el issue correspondiente.

La descripción del PR debe explicar, como mínimo:

- Qué cambia.
- Por qué cambia.
- Qué partes fueron afectadas.
- Cómo probarlo.
- Evidencia relevante, cuando aplique.

Revisa [`CONTRIBUTING.md`](../CONTRIBUTING.md) para las reglas completas.

---

## 13. Primera contribución recomendada

Para una primera contribución, prioriza un issue y/o requerimiento de alcance pequeño y fácil de verificar.

Algunos ejemplos adecuados son:

- Corrección puntual de documentación.
- Ajuste menor de interfaz.
- Corrección de un bug aislado.
- Agregar o corregir una prueba.
- Eliminar una referencia obsoleta.
- Mejorar mensajes de error o validaciones simples.

Evita comenzar directamente con:

- Cambios globales de autenticación.
- Migraciones destructivas.
- Policies complejas de Supabase.
- Cambios de infraestructura.
- Refactors amplios.
- Cambios de deploy o secretos.

El objetivo de la primera contribución es familiarizarte con el flujo del proyecto, no resolver una de las partes más críticas del sistema.

---

## 14. Errores comunes al comenzar


### El proyecto no encuentra variables de entorno

Verifica que:

- Existe `.env`.
- Las variables están escritas correctamente.
- Los nombres coinciden con `.env.example`.
- Reiniciaste el servidor después de modificar variables.

### `npm run check` no existe

Verifica que tu rama contiene la versión actual de `package.json`.

Actualiza tu rama antes de modificar scripts localmente.

### Playwright no encuentra un navegador

Ejecuta:

```bash
npx playwright install
```

### El puerto `4321` está ocupado

Cierra el proceso que está usando el puerto o inicia Astro usando otro puerto temporal.

### El proyecto no conecta con Supabase

Comprueba primero las variables de entorno.

No modifiques código de conexión hasta descartar un problema de configuración local.

### El build falla después de actualizar tu rama

Ejecuta:

```bash
npm ci
```

y vuelve a probar:

```bash
npm run check
npm run build
```

Si el error persiste, revisa si el fallo también ocurre en la rama base antes de atribuirlo a tus cambios.

---

## 15. Cuándo pedir ayuda

Antes de consultar a otra persona:

1. Lee el mensaje de error completo.
2. Revisa el documento relacionado.
3. Busca un issue (si existe) sobre el problema.
4. Verifica que estás trabajando sobre una rama actualizada.

Cuando pidas ayuda, incluye:

- Qué intentabas hacer.
- Qué comando ejecutaste.
- Qué resultado esperabas.
- Qué error obtuviste.
- Qué soluciones ya intentaste.

Evita enviar únicamente una captura sin contexto cuando puedas proporcionar también el mensaje de error en texto.

---

## 16. Canales y responsables

Los nombres, roles y canales de comunicación pueden cambiar con el tiempo.

Actualmente, se cuentan con dos niveles de comunicación, el equipo de desarrollo y los directores del área de I+D, a través de la comunidad y grupo de Whatsapp.

La fuente oficial para responsables y canales debe mantenerse en el espacio de coordinación definido por el equipo.

Como mínimo, un integrante nuevo debe saber a quién acudir para:

- Accesos al repositorio.
- Accesos a Supabase.
- Accesos a Vercel.
- Infraestructura y dominio.
- Revisión de Pull Requests.
- Decisiones técnicas.
- Dudas funcionales del producto.

---

## 17. Checklist de onboarding

Antes de considerar completado tu onboarding técnico, verifica lo siguiente:

- [ ] Tengo acceso al repositorio de GitHub.
- [ ] Tengo los accesos externos necesarios para mi rol.
- [ ] Instalé la versión requerida de Node.js.
- [ ] Instalé las dependencias desde una instalación limpia.
- [ ] Configuré mi archivo `.env`.
- [ ] Instalé los navegadores de Playwright.
- [ ] `npm run check` funciona correctamente.
- [ ] `npm run build` funciona correctamente.
- [ ] `npm run test:e2e` funciona correctamente.
- [ ] Puedo levantar el proyecto con `npm run dev`.
- [ ] Revisé el `README.md`.
- [ ] Revisé `setup.md`.
- [ ] Revisé `arquitectura.md`.
- [ ] Revisé `CONTRIBUTING.md`.
- [ ] Comprendo dónde se encuentran las rutas API.
- [ ] Comprendo, a nivel general, cómo se utiliza Supabase.
- [ ] Sé cómo crear una rama siguiendo la convención del equipo.
- [ ] Sé cómo relacionar un Pull Request con un issue.
- [ ] Realicé o tengo asignada una primera contribución de alcance pequeño.

---

## 18. Validación del onboarding

Este documento debe probarse periódicamente con una persona que no haya participado en la configuración reciente del proyecto.

La prueba se considera satisfactoria si esa persona puede:

1. Obtener los accesos necesarios.
2. Clonar el repositorio.
3. Instalar dependencias.
4. Configurar el entorno.
5. Ejecutar las validaciones.
6. Levantar la aplicación.
7. Identificar dónde se encuentra la documentación relevante.
8. Crear una rama y realizar una primera contribución.

Si alguno de estos pasos requiere una explicación verbal que no esté documentada, el onboarding debe actualizarse antes de considerarse completo.
