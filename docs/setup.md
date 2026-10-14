# Setup y Configuración

## Requisitos

- Node.js >=22.12.0
- npm
- Proyecto de Supabase (DB, Storage y Auth)

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

* `GOOGLE_APPLICATION_CREDENTIALS`, si se utiliza la sincronización con Drive
* `DRIVE_EXAMS_FOLDER_ID`, si se utiliza la sincronización con Drive
* `DRIVE_SOLUTIONS_FOLDER_ID`, si se utiliza la sincronización con Drive

Estas variables no deben exponerse mediante el prefijo `PUBLIC_` ni utilizarse directamente en componentes ejecutados en el navegador.

### Cliente (publicas)

- `PUBLIC_SUPABASE_URL`
- `PUBLIC_SUPABASE_ANON_KEY`



## Base de datos

La base de datos se construye mediante:

1. El esquema inicial del proyecto (`supabase/schema.sql`).
2. Las migraciones numeradas del directorio `supabase/migrations/`, ejecutadas en orden.
3. Las migraciones sin prefijo numérico para módulos independientes (mallas curriculares, feedback).

`supabase/function_triggers.sql` ya no forma parte del flujo de instalación. Sus funciones y triggers fueron distribuidos dentro de las migraciones correspondientes.

### Inventario de migraciones

El directorio `supabase/migrations/` contiene 38 archivos. Todas las migraciones tienen prefijo numérico y deben ejecutarse en el orden indicado en la sección «Instalación nueva». Las migraciones `36`, `29`–`35` y `37` incorporan los módulos de feedback, moderación y mallas curriculares.

> **Nota sobre el prefijo `23_`:** existen dos archivos con este prefijo. `23_fix_statistics_triggers.sql` corrige los triggers de estadísticas y `23_migrate_to_supabase_auth.sql` migra la autenticación de Firebase a Supabase Auth. Se deben ejecutar en ese orden: primero `23_fix_statistics_triggers.sql`, luego `23_migrate_to_supabase_auth.sql`.

> **Nota sobre la migración `24_`:** esta migración aplica el endurecimiento de seguridad únicamente sobre las tablas que ya existen en ese punto (`profiles`, `courses`, `sheets`, `courses_teachers`, `teacher_ratings`, `sheet_ratings`, `sheet_views`, `write_limits`, `sheet_interests`). El endurecimiento de `sheet_feedback` y las tablas de mallas curriculares se aplica en la migración `37`, después de que dichas tablas son creadas.

#### Migraciones numeradas

| # | Archivo | Descripción |
|---|---|---|
| 01 | `01_add_teacher_visibility.sql` | Agrega visibilidad configurable para docentes |
| 02 | `02_add_sheets_indices.sql` | Índices para `exam_storage_path` y `thumb_storage_path` |
| 03 | `03_add_student_profiles.sql` | Tabla `profiles` vinculada a `auth.users` |
| 04 | `04_add_anon_comments_to_teacher_ratings.sql` | Soporte de comentarios anónimos en valoraciones |
| 05 | `05_add_specialties.sql` | Tabla `specialties` (carreras/especialidades) |
| 06 | `06_add_student_details.sql` | Tabla `student_details` para datos de usuario |
| 07 | `07_add_user_id_to_ratings.sql` | Columna `user_id` en `teacher_ratings` |
| 08 | `08_add_avatar_to_reviews.sql` | Permisos de lectura en `student_details` + FK a ratings |
| 09 | `09_update_teacher_ratings_rls.sql` | Política RLS de lectura pública para ratings |
| 10 | `10_update_teacher_ratings_grants.sql` | Vista `public_teacher_ratings` que enmascara datos anónimos |
| 11 | `11_add_contributions.sql` | Tabla `contributions` (aportes de estudiantes) |
| 12 | `12_revoke_contributions_permissions.sql` | Limpieza de permisos antiguos en `contributions` |
| 13 | `13_update_student_details_grants_and_fk.sql` | Corrección de permisos y FK en `student_details` |
| 14 | `14_remove_email_from_public_ratings.sql` | Elimina `user_email` de la vista pública de reseñas |
| 15 | `15_finalize_user_profiles.sql` | Consolida perfiles de usuario y sincronización con Auth |
| 16 | `16_add_evaluation_catalogs.sql` | Catálogos: `cycles`, `evaluation_systems`, `evaluation_type` |
| 17 | `17_add_course_configuration.sql` | Configuración de cursos: `summary`, `system_id`, `status`, etc. |
| 18 | `18_add_course_evaluations.sql` | Tabla `course_evaluations` y funciones administrativas |
| 19 | `19_add_teacher_specific_sheets.sql` | Planchas por docente: `evaluation_id`, `is_teacher_specific` |
| 20 | `20_add_sheet_interests.sql` | Solicitudes de solucionario: `sheet_interests` + triggers |
| 21 | `21_prevent_deleting_courses_with_sheets.sql` | Función `delete_empty_course` para eliminación segura |
| 22 | `22_add_teacher_rating_moderation.sql` | Moderación de valoraciones de docentes |
| 23a | `23_fix_statistics_triggers.sql` | Recrea triggers de estadísticas de forma idempotente |
| 23b | `23_migrate_to_supabase_auth.sql` | Migración de Firebase Auth a Supabase Auth (convierte `user_id` a UUID, crea trigger `handle_new_user`) |
| 24 | `24_harden_database_access.sql` | Endurecimiento de acceso sobre tablas existentes: perfiles, cursos, planchas, valoraciones de docentes y telemetría |
| 25 | `25_secure_sheet_ratings.sql` | Políticas RLS finales para valoraciones de planchas |
| 26 | `26_secure_sheet_views.sql` | Políticas RLS finales para vistas de planchas |
| 27 | `27_secure_write_limits.sql` | Restricciones de escritura para roles cliente |
| 28 | `28_harden_public_schema_defaults.sql` | Privilegios predeterminados del esquema público |

#### Migraciones de módulos nuevos (29–37)

| # | Archivo | Descripción |
|---|---|---|
| 36 | `36_add_sheet_feedback.sql` | Tabla `sheet_feedback` con RLS básico y función `get_average_stars` |
| 29 | `29_add_user_to_sheet_feedback.sql` | Añade columnas de usuario a `sheet_feedback`; crea tabla `sheet_feedback_reactions` |
| 30 | `30_teacher_ratings_post_moderation.sql` | Cambia `teacher_ratings` a post-moderación; actualiza vista y política RLS |
| 31 | `31_fix_teacher_ratings_grants.sql` | Otorga `SELECT` sobre `teacher_ratings` y `student_details` a roles cliente |
| 32 | `32_create_mallas_tables.sql` | Tablas `study_plans`, `plan_courses`, `course_prerequisites`; añade columna `code` a `specialties` |
| 33 | `33_add_malla_rpc.sql` | Función RPC `add_malla_transaction` |
| 34 | `34_edit_malla_rpc.sql` | Función RPC `edit_malla_transaction` |
| 35 | `35_add_save_malla_rpc.sql` | Función RPC `save_malla_transaction` |
| 37 | `37_harden_new_module_access.sql` | Endurecimiento de acceso para `sheet_feedback`, `sheet_feedback_reactions` y tablas de mallas curriculares |

> **Nota sobre el orden de 36 y 29:** la migración `36` crea la tabla `sheet_feedback` y debe ejecutarse **antes** que la `29`, que añade columnas sobre esa misma tabla. El orden de ejecución no es el numérico estricto en este tramo; consulta la lista completa de la sección «Instalación nueva».

> **Nota sobre la migración 37:** consolida las políticas RLS y permisos de columna que la migración `24` no podía aplicar, porque en ese punto las tablas `sheet_feedback` y las de mallas aún no existían. La `37` debe ejecutarse después de la `35`.

Las migraciones de mallas (`32`–`35`) requieren que las tablas `courses` y `specialties` existan previamente. La migración `36` y la `29` requieren que la tabla `sheets` exista.

### Instalación nueva

Para una base de datos vacía, ejecutar primero el esquema inicial (que contiene únicamente la línea base antes de las migraciones):

```text
supabase/schema.sql
```

Después, ejecutar las migraciones en el siguiente orden exacto:

```text
supabase/migrations/01_add_teacher_visibility.sql
supabase/migrations/02_add_sheets_indices.sql
supabase/migrations/03_add_student_profiles.sql
supabase/migrations/04_add_anon_comments_to_teacher_ratings.sql
supabase/migrations/05_add_specialties.sql
supabase/migrations/06_add_student_details.sql
supabase/migrations/07_add_user_id_to_ratings.sql
supabase/migrations/08_add_avatar_to_reviews.sql
supabase/migrations/09_update_teacher_ratings_rls.sql
supabase/migrations/10_update_teacher_ratings_grants.sql
supabase/migrations/11_add_contributions.sql
supabase/migrations/12_revoke_contributions_permissions.sql
supabase/migrations/13_update_student_details_grants_and_fk.sql
supabase/migrations/14_remove_email_from_public_ratings.sql
supabase/migrations/15_finalize_user_profiles.sql
supabase/migrations/16_add_evaluation_catalogs.sql
supabase/migrations/17_add_course_configuration.sql
supabase/migrations/18_add_course_evaluations.sql
supabase/migrations/19_add_teacher_specific_sheets.sql
supabase/migrations/20_add_sheet_interests.sql
supabase/migrations/21_prevent_deleting_courses_with_sheets.sql
supabase/migrations/22_add_teacher_rating_moderation.sql
supabase/migrations/23_fix_statistics_triggers.sql
supabase/migrations/23_migrate_to_supabase_auth.sql
supabase/migrations/24_harden_database_access.sql
supabase/migrations/25_secure_sheet_ratings.sql
supabase/migrations/26_secure_sheet_views.sql
supabase/migrations/27_secure_write_limits.sql
supabase/migrations/28_harden_public_schema_defaults.sql
supabase/migrations/36_add_sheet_feedback.sql
supabase/migrations/29_add_user_to_sheet_feedback.sql
supabase/migrations/30_teacher_ratings_post_moderation.sql
supabase/migrations/31_fix_teacher_ratings_grants.sql
supabase/migrations/32_create_mallas_tables.sql
supabase/migrations/33_add_malla_rpc.sql
supabase/migrations/34_edit_malla_rpc.sql
supabase/migrations/35_add_save_malla_rpc.sql
supabase/migrations/37_harden_new_module_access.sql
```

#### Dependencias clave

* Las migraciones `16` – `18` (catálogos, configuración y evaluaciones de cursos) deben ejecutarse en ese orden.
* La migración `17` debe completar el `system_id` de los cursos existentes antes de establecerlo como obligatorio.
* La migración `19` (planchas por docente) requiere que `evaluation_type` y `course_evaluations` existan.
* La migración `23_migrate_to_supabase_auth` convierte las columnas `user_id` de texto a UUID y trunca datos locales existentes en `student_details`, `teacher_ratings` y `contributions`.
* Las migraciones `24` – `28` aplican las políticas de seguridad y endurecimiento sobre las tablas base; deben preceder a las migraciones de los módulos nuevos.
* La migración `36` crea la tabla `sheet_feedback` y debe ejecutarse **antes** de la `29`, que añade columnas y la tabla relacionada `sheet_feedback_reactions` sobre ella.
* Las migraciones de mallas curriculares (`32`–`35`) requieren las tablas `courses` y `specialties`, y deben ejecutarse en ese orden numérico.
* La migración `36` (y por tanto la `29`) requiere que la tabla `sheets` exista.
* La migración `37` aplica el endurecimiento de acceso a `sheet_feedback`, `sheet_feedback_reactions` y las tablas de mallas. Debe ejecutarse **después** de la `35` (la última migración de mallas) para garantizar que todas las tablas objetivo existen.

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
4. Ejecutar únicamente las migraciones pendientes, respetando el orden numérico.
5. **ATENCIÓN:** La migración `23_migrate_to_supabase_auth.sql` ejecuta `TRUNCATE CASCADE` sobre `student_details`, `teacher_ratings` y `contributions`. **ESTA MIGRACIÓN NO DEBE APLICARSE EN PRODUCCIÓN.** Para comprobar de forma fiable si ya fue aplicada, verifica si la columna `user_id` de la tabla `student_details` es de tipo `uuid` (ejecutando `SELECT data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'student_details' AND column_name = 'user_id';`). Si el tipo es `uuid`, omite este archivo. Si el tipo es `text`, la base no ha sido migrada y se requiere un enfoque manual de conversión de `user_id` sin usar el script automatizado.
6. Verificar el backfill de `system_id`, evaluaciones y demás relaciones antes de aplicar restricciones `NOT NULL`.
7. Ejecutar las migraciones de seguridad y permisos (`24` – `28`) primero, y a continuación las migraciones de módulos nuevos en el orden: `36` → `29` → `30` → `31` → `32` → `33` → `34` → `35` → `37`.
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
* Que `student_details.user_id` sea de tipo UUID y referencie a `auth.users(id)`.
* Que el trigger `on_auth_user_created` exista sobre `auth.users` y ejecute `handle_new_user()`.
* Que la tabla `sheet_feedback` exista, tenga RLS habilitado y contenga las columnas `user_id`, `user_name`, `user_email`, `user_avatar` e `is_anonymous`.
* Que la tabla `sheet_feedback_reactions` exista y tenga RLS habilitado.
* Que las tablas `study_plans`, `plan_courses` y `course_prerequisites` existan con RLS habilitado.
* Que las funciones `add_malla_transaction`, `edit_malla_transaction` y `save_malla_transaction` existan y solo puedan ejecutarse con `service_role`.

## Storage buckets

Crear los siguientes buckets:

* `exams`
* `solutions`
* `thumbnails`
* `avatars` (público, para las fotos de perfil)
* `contributions` (privado, para moderación)
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