# Setup y Configuración

## Requisitos

- Node.js 18 o superior
- npm
- Proyecto de Supabase con Database y Storage
- Acceso administrativo al proyecto de Supabase

## Instalación local

```bash
npm install
cp .env.example .env
npm run dev
```

Servidor local:

```text
http://localhost:4321
```

## Variables de entorno

Usar `.env.example` como referencia.

### Servidor — variables privadas

* `SUPABASE_URL`
* `SUPABASE_SERVICE_KEY`
* `IP_SALT`
* `ADMIN_PASS`
* `GOOGLE_APPLICATION_CREDENTIALS`, si se utiliza la sincronización con Drive
* `DRIVE_EXAMS_FOLDER_ID`, si se utiliza la sincronización con Drive
* `DRIVE_SOLUTIONS_FOLDER_ID`, si se utiliza la sincronización con Drive

Estas variables no deben exponerse mediante el prefijo `PUBLIC_` ni utilizarse directamente en componentes ejecutados en el navegador.

### Cliente — variables públicas

* `PUBLIC_SUPABASE_URL`
* `PUBLIC_SUPABASE_ANON_KEY`

## Base de datos

La base de datos se construye mediante:

1. El esquema inicial del proyecto.
2. Las migraciones organizadas por funcionalidad.
3. Las migraciones finales de seguridad y permisos.

`supabase/function_triggers.sql` ya no forma parte del flujo de instalación. Sus funciones y triggers fueron distribuidos dentro de las migraciones correspondientes.

### Instalación nueva

Para una base de datos vacía, ejecutar primero:

```text
supabase/schema.sql
```

Después, ejecutar las migraciones en el siguiente orden.

#### 1. Configuración inicial de seguridad

```text
supabase/migrations/harden_public_schema_defaults.sql
```

Esta migración configura los privilegios predeterminados para evitar que las nuevas funciones queden disponibles automáticamente para roles cliente.

#### 2. Perfiles de usuario

```text
supabase/migrations/add_user_profiles.sql
```

Crea las estructuras relacionadas con los perfiles y la sincronización con los usuarios autenticados.

#### 3. Catálogos de evaluación

```text
supabase/migrations/add_evaluation_catalogs.sql
```

Crea primero las estructuras requeridas por la gestión de cursos:

* `cycles`
* `evaluation_systems`
* `evaluation_subsystems`
* `evaluation_type`
* relaciones entre sistemas, notas y evaluaciones

Los catálogos deben existir antes de agregar las relaciones y configuraciones de los cursos.

#### 4. Configuración administrativa de cursos

```text
supabase/migrations/add_course_configuration.sql
```

Agrega y configura, entre otros campos:

* `courses.summary`
* `courses.system_id`
* `courses.subsystem_id`
* `courses.status`
* `courses.is_hidden`

La migración debe completar el `system_id` de los cursos existentes antes de establecerlo como obligatorio.

#### 5. Evaluaciones asociadas a cursos

```text
supabase/migrations/add_course_evaluations.sql
```

Crea:

* `course_evaluations`
* relaciones entre cursos y evaluaciones
* `create_course_with_evaluations`
* `update_course_with_evaluations`

Las funciones administrativas quedan disponibles únicamente para `service_role`.

#### 6. Visibilidad y moderación de docentes

```text
supabase/migrations/add_teacher_visibility.sql
supabase/migrations/add_teacher_rating_moderation.sql
```

Estas migraciones agregan la visibilidad de docentes y la moderación de sus valoraciones.

#### 7. Planchas por docente y evaluación

```text
supabase/migrations/add_teacher_specific_sheets.sql
```

Agrega:

* `sheets.evaluation_id`
* `sheets.is_teacher_specific`
* relaciones e índices asociados

Esta migración debe ejecutarse después de crear `evaluation_type` y `course_evaluations`.

#### 8. Eliminación segura de cursos

```text
supabase/migrations/prevent_deleting_courses_with_sheets.sql
```

Crea la función `delete_empty_course` que impide eliminar cursos con planchas asociadas, evitando archivos huérfanos en Storage.

#### 9. Solicitudes de solucionario

```text
supabase/migrations/add_sheet_interests.sql
```

Agrega:

* `sheets.interest_count`
* `sheet_interests`
* funciones para registrar y reiniciar solicitudes
* trigger de sincronización del contador
* RLS y restricciones de acceso

La tabla `sheet_interests` es interna y solo puede ser utilizada desde el backend mediante `supabaseAdmin` y `service_role`.

#### 10. Seguridad de valoraciones, vistas y límites

Ejecutar estas migraciones al final:

```text
supabase/migrations/secure_sheet_ratings.sql
supabase/migrations/secure_sheet_views.sql
supabase/migrations/secure_write_limits.sql
```

Estas migraciones aplican las políticas RLS, permisos y restricciones finales de las tablas utilizadas por los endpoints públicos.

### Datos iniciales

Después de crear las estructuras, se puede ejecutar opcionalmente:

```text
supabase/seed.sql
```

El archivo debe cumplir estas condiciones:

* Los sistemas y subsistemas referenciados deben existir.
* Cada curso debe incluir un `system_id` válido.
* Los identificadores de evaluaciones deben existir en `evaluation_type`.
* No debe duplicar registros ya insertados por las migraciones.
* Debe poder ejecutarse después de las migraciones estructurales.

### Base de datos existente

Para actualizar una base que ya contiene datos:

1. Crear una copia de seguridad.
2. No volver a ejecutar `supabase/schema.sql`.
3. No volver a ejecutar migraciones ya aplicadas.
4. Ejecutar únicamente las migraciones pendientes.
5. Respetar el mismo orden de dependencias utilizado para instalaciones nuevas.
6. Verificar el backfill de `system_id`, evaluaciones y demás relaciones antes de aplicar restricciones `NOT NULL`.
7. Ejecutar las migraciones de seguridad y permisos al final.
8. Validar el funcionamiento de los endpoints administrativos y públicos.

No deben ejecutarse simultáneamente cambios duplicados presentes en `schema.sql` y en las migraciones. El archivo `schema.sql` representa únicamente el esquema inicial; las modificaciones posteriores pertenecen al directorio `supabase/migrations`.

### Verificación posterior

Después de aplicar las migraciones, comprobar:

* Que todos los cursos tengan un `system_id` válido.
* Que las evaluaciones de los cursos existan en `course_evaluations`.
* Que `sheets.evaluation_id` apunte a una evaluación existente.
* Que las funciones administrativas solo puedan ejecutarse con `service_role`.
* Que `sheet_interests` tenga RLS habilitado y no tenga políticas para `anon` o `authenticated`.
* Que los contadores de solicitudes, vistas y valoraciones estén sincronizados.
* Que una plancha o curso oculto no sea accesible mediante endpoints públicos.

## Storage buckets

Crear los siguientes buckets:

* `exams`
* `solutions`
* `thumbnails`

Los buckets deben ser privados. El acceso a los archivos se realiza mediante URLs firmadas generadas por endpoints del servidor.

## Scripts disponibles

* `npm run dev`
* `npm run build`
* `npm run preview`
* `npm run drive:sync`
* `npm run drive:sync-exams`
* `npm run drive:sync-solutions`

## Notas operativas

* `SUPABASE_SERVICE_KEY` nunca debe exponerse al cliente.
* Las operaciones con `supabaseAdmin` deben ejecutarse exclusivamente en el servidor.
* Los endpoints administrativos requieren una sesión administrativa válida.
* Los errores internos de Supabase o PostgreSQL deben registrarse en el servidor y no devolverse directamente al cliente.
* Si se utilizan scripts de Drive, debe verificarse el acceso al archivo JSON de la cuenta de servicio.
* Las nuevas migraciones deben respetar sus dependencias y evitar recrear objetos que ya existan.