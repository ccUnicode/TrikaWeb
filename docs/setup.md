# Setup y configuración

Este documento describe cómo preparar, configurar y validar un entorno local de TrikaWeb.

Para una guía de incorporación al proyecto, accesos necesarios y primera contribución, consultar [`onboarding.md`](./onboarding.md).

## Requisitos

Antes de comenzar, instalar:

- Node.js >= 22.12.0.
- npm.
- Git.

Para ejecutar las pruebas E2E también se requieren los navegadores administrados por Playwright.

## Instalación local

Clonar el repositorio:

```bash
git clone <URL_DEL_REPOSITORIO>
cd TrikaWeb
```

Instalar las dependencias utilizando las versiones registradas en `package-lock.json`:

```bash
npm ci
```

Crear el archivo de variables de entorno tomando `.env.example` como referencia.

En Git Bash, Linux o WSL:

```bash
cp .env.example .env
```

En PowerShell:

```powershell
Copy-Item .env.example .env
```

Completar las variables necesarias y levantar el servidor:

```bash
npm run dev
```

Por defecto, la aplicación estará disponible en:

```text
http://localhost:4321
```

## Variables de entorno

Usar `.env.example` como referencia para conocer las variables requeridas y su formato.

No incluir credenciales reales en la documentación ni versionar el archivo `.env`.

### Variables privadas del servidor

Las siguientes variables deben utilizarse exclusivamente desde código ejecutado en el servidor:

- `SUPABASE_URL`: URL del proyecto de Supabase.
- `SUPABASE_SERVICE_KEY`: `service_role` o secret key utilizada por operaciones administrativas.
- `IP_SALT`: cadena aleatoria utilizada para generar hashes asociados a direcciones IP.
- `ADMIN_PASS`: contraseña utilizada para el acceso administrstivo (`/admin/login`).
- `GOOGLE_APPLICATION_CREDENTIALS`: ruta a las credenciales utilizadas por la sincronización con Google Drive, si aplica.
- `DRIVE_EXAMS_FOLDER_ID`: identificador de la carpeta de evaluaciones de Google Drive, si aplica.
- `DRIVE_SOLUTIONS_FOLDER_ID`: identificador de la carpeta de solucionarios de Google Drive, si aplica.

`SUPABASE_SERVICE_KEY`, `IP_SALT`, `ADMIN_PASS` y otras credenciales privadas nunca deben exponerse mediante variables `PUBLIC_*` ni utilizarse directamente desde componentes ejecutados en el navegador.

### Variables públicas del cliente

- `PUBLIC_SUPABASE_URL`: URL pública del proyecto de Supabase.
- `PUBLIC_SUPABASE_ANON_KEY`: clave `anon` o `publishable` utilizada por el cliente.

Las variables con prefijo `PUBLIC_` pueden formar parte del código enviado al navegador y, por lo tanto, no deben contener secretos.

## Autenticación

TrikaWeb utiliza actualmente Supabase Auth para la autenticación de estudiantes.

El flujo de autenticación de estudiantes utiliza OAuth con Google mediante Supabase y las rutas:

```text
/api/auth/signin
/api/auth/callback
/api/auth/logout
```

La autenticación administrativa utiliza su propio flujo de sesión y debe ejecutarse exclusivamente mediante endpoints y utilidades del servidor.

Para conocer el flujo completo, consultar la documentación de arquitectura y API.

## Validación del proyecto

Después de instalar y configurar el proyecto, ejecutar las validaciones antes de comenzar cambios funcionales.

### Validación estática

```bash
npm run check
```

Este comando ejecuta las comprobaciones de Astro y TypeScript.

Debe finalizar sin errores.

### Build de producción

```bash
npm run build
```

El build debe completarse correctamente antes de considerar válido el entorno.

### Pruebas E2E

Las pruebas end-to-end utilizan Playwright.

En una máquina nueva, instalar primero los navegadores requeridos:

```bash
npx playwright install
```

En Linux o entornos CI puede utilizarse:

```bash
npx playwright install --with-deps
```

Ejecutar las pruebas:

```bash
npm run test:e2e
```

Playwright utiliza la configuración definida en `playwright.config.ts` y puede iniciar automáticamente el servidor requerido para las pruebas.

## Base de datos

TrikaWeb utiliza PostgreSQL mediante Supabase.

La configuración de base de datos se encuentra principalmente en:

```text
supabase/
├── migrations/
├── schema.sql
└── seed.sql
```

`supabase/schema.sql` representa el esquema inicial del proyecto.

Los cambios posteriores al esquema deben aplicarse mediante las migraciones almacenadas en:

```text
supabase/migrations/
```

`supabase/function_triggers.sql` no debe utilizarse como una etapa adicional del flujo actual de instalación si sus funciones y triggers ya se encuentran incorporados en las migraciones correspondientes.

### Instalación nueva

Para preparar una base de datos vacía:

1. Crear o seleccionar el proyecto de Supabase correspondiente.
2. Aplicar el esquema inicial cuando el procedimiento del proyecto lo requiera.
3. Aplicar las migraciones pendientes respetando sus dependencias.
4. Ejecutar los datos iniciales únicamente cuando sean necesarios.
5. Verificar las políticas, permisos, funciones y triggers resultantes.

> **Importante:** el orden y los nombres de las migraciones deben corresponder exactamente con los archivos existentes en `supabase/migrations/`.

### Migraciones

Las migraciones representan cambios incrementales realizados sobre la base de datos.

Antes de ejecutar una migración:

1. Revisar si ya fue aplicada al ambiente.
2. Revisar sus dependencias con migraciones anteriores.
3. Comprobar si modifica datos existentes.
4. Crear un backup cuando el cambio pueda afectar información existente.
5. Evitar ejecutar manualmente una migración más de una vez salvo que haya sido diseñada explícitamente para ello.

No deben ejecutarse simultáneamente cambios duplicados presentes en `schema.sql` y en las migraciones.

### Datos iniciales

Cuando se necesiten datos iniciales o de desarrollo, revisar:

```text
supabase/seed.sql
```

Antes de ejecutarlo, verificar que:

- Las estructuras requeridas ya existan.
- Las claves foráneas referenciadas sean válidas.
- Los identificadores utilizados existan en sus tablas correspondientes.
- No duplique información creada previamente por las migraciones.
- El contenido sea apropiado para el ambiente donde se ejecutará.

### Base de datos existente

Para actualizar una base que ya contiene datos:

1. Crear una copia de seguridad cuando el cambio pueda afectar información existente.
2. No volver a ejecutar `supabase/schema.sql`.
3. Identificar qué migraciones ya fueron aplicadas.
4. Ejecutar únicamente las migraciones pendientes.
5. Respetar las dependencias entre migraciones.
6. Verificar los backfills antes de aplicar restricciones como `NOT NULL`.
7. Aplicar las migraciones de seguridad y permisos en el orden definido por el proyecto.
8. Validar los endpoints y flujos afectados.

Nunca asumir que una migración pendiente puede ejecutarse directamente en producción solo porque funciona sobre una base vacía.

### Verificación posterior

Después de aplicar cambios de base de datos, verificar según el alcance de las migraciones:

- Integridad de las relaciones afectadas.
- Restricciones y claves foráneas.
- Índices relevantes.
- Funciones y triggers.
- Políticas RLS.
- Permisos de `anon`, `authenticated` y `service_role`.
- Endpoints que dependen de las tablas modificadas.
- Acceso a recursos ocultos o moderados.
- Contadores o estadísticas mantenidos mediante funciones o triggers.

Las verificaciones específicas de una migración deben documentarse junto con el cambio correspondiente cuando no sean evidentes.

## Storage

TrikaWeb utiliza Supabase Storage para almacenar distintos tipos de archivos.

Los buckets utilizados por el proyecto incluyen:

- `exams`
- `solutions`
- `thumbnails`
- `avatars`
- `contributions`

La visibilidad de cada bucket debe corresponder con las políticas y el mecanismo de acceso implementado actualmente.

No asumir que todos los buckets son públicos ni que todos son privados.

Los archivos privados deben entregarse mediante mecanismos controlados por el servidor, como URLs firmadas, cuando corresponda.

Las operaciones privilegiadas de Storage deben realizarse exclusivamente desde el servidor mediante las credenciales apropiadas.

> Antes de cambiar la visibilidad de un bucket, revisar las políticas de Storage y el código que construye o genera las URLs utilizadas por la aplicación.

## Sincronización con Google Drive

El proyecto contiene scripts para sincronizar determinados recursos desde Google Drive.

Cuando se utilicen, configurar:

```text
GOOGLE_APPLICATION_CREDENTIALS
DRIVE_EXAMS_FOLDER_ID
DRIVE_SOLUTIONS_FOLDER_ID
```

La cuenta de servicio correspondiente debe tener acceso a las carpetas requeridas.

Los scripts disponibles son:

```bash
npm run drive:sync
npm run drive:sync-exams
npm run drive:sync-solutions
```

No versionar el archivo JSON de credenciales de la cuenta de servicio.

## Scripts disponibles

### Desarrollo

```bash
npm run dev
```

Inicia el servidor de desarrollo de Astro.

### Validación

```bash
npm run check
```

Ejecuta las comprobaciones estáticas del proyecto.

### Build

```bash
npm run build
```

Genera el build de producción.

### Preview

```bash
npm run preview
```

Permite ejecutar localmente el resultado del build cuando la configuración del proyecto lo permita.

### Pruebas E2E

```bash
npm run test:e2e
```

Ejecuta las pruebas end-to-end mediante Playwright.

### Sincronización con Drive

```bash
npm run drive:sync
npm run drive:sync-exams
npm run drive:sync-solutions
```

Ejecutan los procesos de sincronización configurados para Google Drive.

## Notas de seguridad

- `SUPABASE_SERVICE_KEY` nunca debe exponerse al cliente.
- Las operaciones con `supabaseAdmin` deben ejecutarse exclusivamente en el servidor.
- Las credenciales reales no deben almacenarse en `.env.example`.
- `.env` no debe versionarse.
- Las credenciales de Google Drive no deben incluirse en el repositorio.
- Los endpoints administrativos deben validar la sesión correspondiente.
- Los errores internos de Supabase o PostgreSQL deben registrarse en el servidor y no exponerse directamente al cliente.
- Las operaciones que requieren `service_role` no deben ejecutarse desde el navegador.

## Resolución de problemas

### Las dependencias no se instalan con `npm ci`

Verificar que:

- `package-lock.json` existe.
- `package.json` y `package-lock.json` están sincronizados.
- Se está utilizando una versión compatible de Node.js.

Si las dependencias fueron modificadas intencionalmente, el integrante que realizó el cambio debe actualizar correctamente `package.json` y `package-lock.json`.

### Playwright no encuentra el navegador

Ejecutar:

```bash
npx playwright install
```

### Las variables de entorno no son reconocidas

Verificar:

1. Que `.env` exista en la raíz.
2. Que los nombres coincidan con `.env.example`.
3. Que no existan espacios o caracteres adicionales.
4. Reiniciar el servidor después de modificar las variables.

### No hay conexión con Supabase

Comprobar primero:

- `SUPABASE_URL`.
- `PUBLIC_SUPABASE_URL`.
- Las claves correspondientes al ambiente.
- Que el proyecto de Supabase esté disponible.

No modificar el código de conexión antes de descartar un problema de configuración.

## Documentación relacionada

- [`onboarding.md`](./onboarding.md): incorporación de nuevos integrantes.
- [`arquitectura.md`](./arquitectura.md): arquitectura y componentes del sistema.
- [`api.md`](./api.md): rutas y contratos de la API.
- [`funcionalidades.md`](./funcionalidades.md): comportamiento funcional.
- [`deploy.md`](./deploy.md): despliegue y operación.
- [`../CONTRIBUTING.md`](../CONTRIBUTING.md): flujo de colaboración.
