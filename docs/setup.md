# Setup y Configuración

## Requisitos

- Node.js >=22.12.0
- npm
- Proyecto de Supabase (DB + Storage)
- Proyecto de Firebase (Auth para estudiantes)

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
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`
* `GOOGLE_APPLICATION_CREDENTIALS`, si se utiliza la sincronización con Drive
* `DRIVE_EXAMS_FOLDER_ID`, si se utiliza la sincronización con Drive
* `DRIVE_SOLUTIONS_FOLDER_ID`, si se utiliza la sincronización con Drive

Estas variables no deben exponerse mediante el prefijo `PUBLIC_` ni utilizarse directamente en componentes ejecutados en el navegador.

### Cliente (publicas)

- `PUBLIC_SUPABASE_URL`
- `PUBLIC_SUPABASE_ANON_KEY`

Nota: Supabase sigue siendo la base de datos y storage; Firebase queda como proveedor de autenticación para estudiantes.

## Base de datos

La base de datos se construye mediante:

1. El esquema inicial del proyecto (`supabase/schema.sql`).
2. Las migraciones numeradas del directorio `supabase/migrations/`, ejecutadas en orden.
3. Las migraciones sin prefijo numérico para módulos independientes (mallas curriculares, feedback).

`supabase/function_triggers.sql` ya no forma parte del flujo de instalación. Sus funciones y triggers fueron distribuidos dentro de las migraciones correspondientes.

### Inventario de migraciones

El directorio `supabase/migrations/` contiene 34 archivos. Las migraciones numeradas (`01_` – `28_`) deben ejecutarse en orden secuencial. Las migraciones sin prefijo numérico corresponden a módulos independientes y se ejecutan al final.

> **Nota sobre el prefijo `23_`:** existen dos archivos con este prefijo. `23_fix_statistics_triggers.sql` corrige los triggers de estadísticas y `23_migrate_to_supabase_auth.sql` migra la autenticación de Firebase a Supabase Auth. Se deben ejecutar en ese orden: primero `23_fix_statistics_triggers.sql`, luego `23_migrate_to_supabase_auth.sql`.

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
| 24 | `24_harden_database_access.sql` | Endurecimiento general de acceso: elimina políticas duplicadas, restringe columnas sensibles |
| 25 | `25_secure_sheet_ratings.sql` | Políticas RLS finales para valoraciones de planchas |
| 26 | `26_secure_sheet_views.sql` | Políticas RLS finales para vistas de planchas |
| 27 | `27_secure_write_limits.sql` | Restricciones de escritura para roles cliente |
| 28 | `28_harden_public_schema_defaults.sql` | Privilegios predeterminados del esquema público |

#### Migraciones sin prefijo numérico (módulos independientes)

| Archivo | Descripción |
|---|---|
| `create_mallas_tables.sql` | Tablas `study_plans`, `plan_courses`, `course_prerequisites` |
| `add_malla_rpc.sql` | Función RPC `add_malla_transaction` |
| `add_save_malla_rpc.sql` | Función RPC `save_malla_transaction` |
| `edit_malla_rpc.sql` | Función RPC `edit_malla_transaction` |
| `add_sheet_feedback.sql` | Tabla `sheet_feedback` con RLS y función `get_average_stars` |

Las migraciones de mallas requieren que la tabla `courses` y `specialties` existan previamente. La migración de feedback requiere que la tabla `sheets` exista.

### Instalación nueva

Para una base de datos vacía, ejecutar primero:

```text
supabase/schema.sql
```

Después, ejecutar las migraciones numeradas en orden secuencial:

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
```

Después de las migraciones numeradas, ejecutar los módulos independientes:

```text
supabase/migrations/create_mallas_tables.sql
supabase/migrations/add_malla_rpc.sql
supabase/migrations/add_save_malla_rpc.sql
supabase/migrations/edit_malla_rpc.sql
supabase/migrations/add_sheet_feedback.sql
```

#### Dependencias clave

* Las migraciones `16` – `18` (catálogos, configuración y evaluaciones de cursos) deben ejecutarse en ese orden.
* La migración `17` debe completar el `system_id` de los cursos existentes antes de establecerlo como obligatorio.
* La migración `19` (planchas por docente) requiere que `evaluation_type` y `course_evaluations` existan.
* La migración `23_migrate_to_supabase_auth` convierte las columnas `user_id` de texto a UUID y trunca datos locales existentes en `student_details`, `teacher_ratings` y `contributions`.
* Las migraciones `24` – `28` aplican las políticas de seguridad y endurecimiento finales; deben ejecutarse al final.
* Las migraciones de mallas curriculares requieren las tablas `courses` y `specialties`.
* La migración de feedback requiere la tabla `sheets`.

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
5. Tener en cuenta que `23_migrate_to_supabase_auth.sql` ejecuta `TRUNCATE CASCADE` sobre `student_details`, `teacher_ratings` y `contributions`. En producción, considerar un enfoque manual de conversión de `user_id` en lugar del truncado.
6. Verificar el backfill de `system_id`, evaluaciones y demás relaciones antes de aplicar restricciones `NOT NULL`.
7. Ejecutar las migraciones de seguridad y permisos (`24` – `28`) al final.
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