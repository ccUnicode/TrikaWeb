# Esquema BD TrikaWeb

## Tablas del Negocio

### courses
| Columna | Tipo | Nulo | Defecto |
|---------|------|------|---------|
| id | bigint PK | NO | |
| code | text | NO | |
| name | text | NO | |
| credits | integer | SI | |
| is_hidden | boolean | SI | |
| system_id | integer | NO | |
| subsystem_id | integer | SI | |
| status | text | NO | `INCOMPLETO` |
| summary | text | SI | |
| is_elective | boolean | SI | |
| avg_difficulty | numeric | SI | |

### teachers
| Columna | Tipo | Nulo | Defecto |
|---------|------|------|---------|
| id | bigint PK | NO | |
| full_name | text | NO | |
| bio | text | NO | |
| avg_overall | numeric | SI | |
| rating_count | integer | SI | |
| avatar_url | text | SI | |
| is_hidden | boolean | NO | false |

## Mallas Curriculares

- specialties (id: serial, name, code, created_at)
- study_plans (id: uuid, specialty_id, year, is_current, is_published, created_at)
- plan_courses (id, plan_id: uuid, course_id, cycle, row_index, created_at)
- course_prerequisites (id, plan_id: uuid, course_id, prerequisite_id, created_at)

> Las escrituras sobre estas tablas se realizan mediante las funciones RPC
> `add_malla_transaction`, `edit_malla_transaction` y `save_malla_transaction`
> (`SECURITY DEFINER`, ejecutables solo por `service_role`). La lectura es pública
> (`FOR SELECT`). Fuente: `supabase/migrations/create_mallas_tables.sql`.

### courses_teachers
| Columna | Tipo | Nulo |
|---------|------|------|
| course_id | bigint PK | NO |
| teacher_id | bigint PK | NO |
| modality | text | SI |

### sheets
| Columna | Tipo | Nulo | Defecto |
|---------|------|------|---------|
| id | bigint PK | NO | |
| course_id | bigint FK | NO | |
| cycle | text | NO | |
| exam_type | text | NO | |
| teacher_hint | text | SI | |
| exam_storage_path | text | NO | |
| solution_kind | text | SI | `'pdf' \| 'video'` |
| solution_storage_path | text | SI | |
| solution_video_url | text | SI | |
| thumb_storage_path | text | SI | |
| avg_difficulty | numeric | SI | |
| rating_count | integer | SI | |
| view_count | bigint | SI | |
| is_hidden | boolean | NO | |
| interest_count | bigint | SI | |
| evaluation_id | integer | SI | |
| is_teacher_specific | boolean | NO | false |

### sheet_ratings
| Columna | Tipo | Nulo |
|---------|------|------|
| id | bigint PK | NO |
| sheet_id | bigint FK | NO |
| device_id | uuid | NO |
| ip_hash | text | NO |
| score | integer (1-5) | NO |
| created_at | timestamptz | SI |

### sheet_views
| Columna | Tipo | Nulo |
|---------|------|------|
| id | bigint PK | NO |
| sheet_id | bigint FK | NO |
| type | text (`'view'\|'download'`) | NO |
| device_id | uuid | NO |
| ip_hash | text | NO |
| occurred_at | timestamptz | SI |

### sheet_interests
| Columna | Tipo | Nulo |
|---------|------|------|
| id | bigint PK | NO |
| sheet_id | bigint FK | NO |
| device_id | uuid | NO |
| ip_hash | text | NO |
| created_at | timestamptz | NO |

### sheet_feedback
| Columna | Tipo | Nulo |
|---------|------|------|
| id | bigint PK | NO |
| sheet_id | bigint FK | NO |
| stars | smallint | NO |
| content | text | SI |
| device_id | uuid | NO |
| ip_hash | text | SI |
| is_hidden | boolean | SI |
| needs_review | boolean | SI |
| created_at | timestamptz | SI |
| updated_at | timestamptz | SI |

### teacher_ratings
| Columna | Tipo | Nulo | Defecto |
|---------|------|------|---------|
| id | bigint PK | NO | |
| teacher_id | bigint FK | NO | |
| device_id | uuid | NO | |
| ip_hash | text | NO | |
| overall | numeric | NO | |
| difficulty | integer (1-5) | NO | |
| didactic | integer (1-5) | NO | |
| resources | integer (1-5) | NO | |
| responsability | integer (1-5) | NO | |
| grading | integer (1-5) | NO | |
| comment | text | SI | |
| is_hidden | boolean | NO | false |
| created_at | timestamptz | NO | |
| updated_at | timestamptz | NO | |
| needs_review | boolean | SI | |
| is_anonymous | boolean | NO | false |
| user_name | text | SI | |
| user_email | text | SI | |

## Tablas de Sistema de Evaluación

### evaluation_systems
| Columna | Tipo | Nulo |
|---------|------|------|
| system_id | integer PK | NO |
| system_cod | character | NO |
| system_description | text | NO |
| requires_subsystem | boolean | SI |

### evaluation_subsystems
| Columna | Tipo | Nulo |
|---------|------|------|
| subsystem_id | integer PK | NO |
| subsystem_cod | character varying | NO |
| practices_quantity | integer | NO |

### evaluation_type
| Columna | Tipo | Nulo |
|---------|------|------|
| evaluation_id | integer PK | NO |
| evaluation_name | text | SI |
| evaluation_abr | text | SI |
| evaluation_category | text | SI |

### course_evaluations
| Columna | Tipo | Nulo |
|---------|------|------|
| course_id | integer | SI |
| evaluation_id | integer | SI |

### eval_system_grades
| Columna | Tipo | Nulo |
|---------|------|------|
| grade_id | integer PK | NO |
| grades_name | text | NO |

### system_grades_consider
| Columna | Tipo | Nulo |
|---------|------|------|
| system_id | integer PK | NO |
| grade_id | integer PK | NO |
| weight | integer | NO |

### grade_evaluation_type
| Columna | Tipo | Nulo |
|---------|------|------|
| grade_id | integer | SI |
| evaluation_id | integer | SI |

## Tablas de Usuarios y Plan de Estudios

### profiles
| Columna | Tipo | Nulo |
|---------|------|------|
| id | uuid PK | NO |
| email | text | SI |
| full_name | text | SI |
| role | USER-DEFINED (enum) | NO |
| created_at | timestamptz | NO |
| updated_at | timestamptz | NO |
| username | text | SI |
| avatar_url | text | SI |

### study_plans
| Columna | Tipo | Nulo |
|---------|------|------|
| id | uuid PK | NO |
| specialty_id | uuid | SI |
| year | text | NO |
| is_current | boolean | SI |
| is_published | boolean | SI |

### specialties
| Columna | Tipo | Nulo |
|---------|------|------|
| id | uuid PK | NO |
| name | text | NO |

### plan_courses
| Columna | Tipo | Nulo |
|---------|------|------|
| plan_id | uuid PK | NO |
| course_id | bigint PK | NO |
| cycle | integer | NO |
| row_index | integer | SI |

### course_prerequisites
| Columna | Tipo | Nulo |
|---------|------|------|
| plan_id | uuid PK | NO |
| course_id | bigint PK | NO |
| prerequisite_id | bigint PK | NO |

## Tablas de Moderación y Colaboración

### contributions
| Columna | Tipo | Nulo |
|---------|------|------|
| id | bigint PK | NO |
| user_id | text | NO |
| user_email | text | NO |
| user_name | text | NO |
| course_id | bigint | NO |
| cycle | text | NO |
| exam_type | text | NO |
| contribution_type | text | NO |
| file_storage_path | text | NO |
| status | text | NO |
| admin_notes | text | SI |
| created_at | timestamptz | NO |
| updated_at | timestamptz | NO |

## Tablas Auxiliares

### cycles
| Columna | Tipo | Nulo |
|---------|------|------|
| cycle_id | bigint PK | NO |
| cycle_code | character varying | NO |
| year | integer | NO |
| term | character varying | NO |

### write_limits
| Columna | Tipo | Nulo |
|---------|------|------|
| ip_hash | text PK | NO |
| last_at | timestamptz | NO |
| count_1h | integer | NO |

## Storage Buckets

Configuración verificada en Supabase Storage:

| Bucket | Contenido | Visibilidad | Forma de acceso | Límite de bucket | MIME types |
|--------|-----------|-------------|-----------------|------------------|------------|
| `exams` | PDFs de planchas | Privado | URL firmada generada por el servidor | Sin límite configurado | Sin restricción configurada |
| `solutions` | PDFs de solucionarios | Privado | URL firmada generada por el servidor | Sin límite configurado | Sin restricción configurada |
| `thumbnails` | Miniaturas de preview | Público | URL pública | Sin límite configurado | `image/jpeg`, `image/png` |
| `avatars` | Avatares de usuarios | Público | URL pública | Sin límite configurado | `image/jpeg`, `image/png`, `image/webp` |
| `contributions` | Archivos subidos para moderación | Privado | URL firmada para revisión administrativa | 10 MB | Sin restricción configurada |

No existen policies explícitas vigentes sobre `storage.objects` para estos buckets. Las operaciones de escritura, eliminación y generación de URLs firmadas se realizan desde endpoints del servidor con `supabaseAdmin`/`service_role`. La lectura pública de `avatars` y `thumbnails` utiliza las rutas públicas de Supabase Storage.

Notas de límites de aplicación:

- `avatars` no tiene límite de tamaño configurado a nivel de bucket; los endpoints de perfil aplican validaciones de tamaño y MIME antes de subir archivos.
- `contributions` aplica un límite de 10 MB a nivel de bucket.
- `exams`, `solutions` y `thumbnails` no tienen un límite de tamaño configurado actualmente a nivel de bucket.

## Índices

### Tablas del negocio

| Tabla | Índice | Tipo | Columnas |
|-------|--------|------|----------|
| `courses` | `courses_pkey` | PK | `id` |
| `courses` | `courses_code_key` | Unique | `code` |
| `courses` | `uq_courses_code_nocase` | Unique | `lower(code)` |
| `teachers` | `teachers_pkey` | PK | `id` |
| `teachers` | `uq_teachers_name_nocase` | Unique | `lower(full_name)` |
| `teachers` | `idx_teachers_is_hidden` | Index | `is_hidden` |
| `courses_teachers` | `courses_teachers_pkey` | PK | `course_id, teacher_id` |
| `courses_teachers` | `ix_courses_teachers__teacher` | Index | `teacher_id` |
| `sheets` | `sheets_pkey` | PK | `id` |
| `sheets` | `uq_sheets_course_cycle_type_teacher` | Unique | `(course_id, cycle, lower(exam_type), COALESCE(lower(teacher_hint), ''))` |
| `sheets` | `ix_sheets_course` | Index | `course_id` |
| `sheets` | `ix_sheets_exam_storage_path` | Index | `exam_storage_path` |
| `sheets` | `ix_sheets_thumb_storage_path` | Index | `thumb_storage_path` |
| `sheet_ratings` | `sheet_ratings_pkey` | PK | `id` |
| `sheet_ratings` | `sheet_ratings_sheet_id_device_id_key` | Unique | `sheet_id, device_id` |
| `sheet_views` | `sheet_views_pkey` | PK | `id` |
| `sheet_interests` | `sheet_interests_pkey` | PK | `id` |
| `sheet_interests` | `sheet_interests_sheet_id_device_id_key` | Unique | `sheet_id, device_id` |
| `sheet_interests` | `idx_sheet_interests_sheet_id` | Index | `sheet_id` |
| `sheet_feedback` | `sheet_feedback_pkey` | PK | `id` |
| `sheet_feedback` | `idx_sheet_feedback_sheet_id` | Index | `sheet_id` |
| `sheet_feedback` | `idx_sheet_feedback_device_sheet` | Index | `sheet_id, device_id` |
| `sheet_feedback` | `idx_sheet_feedback_needs_review` | Partial | `needs_review` WHERE `needs_review = true` |
| `teacher_ratings` | `teacher_ratings_pkey` | PK | `id` |
| `teacher_ratings` | `idx_teacher_ratings_teacher_id` | Index | `teacher_id` |
| `teacher_ratings` | `idx_teacher_ratings_needs_review` | Partial | `needs_review` WHERE `needs_review = true` |
| `contributions` | `contributions_pkey` | PK | `id` |

### Tablas de sistema de evaluación

| Tabla | Índice | Tipo | Columnas |
|-------|--------|------|----------|
| `evaluation_systems` | `evaluation_systems_pkey` | PK | `system_id` |
| `evaluation_systems` | `evaluation_systems_system_cod_key` | Unique | `system_cod` |
| `evaluation_subsystems` | `evaluation_subsystems_pkey` | PK | `subsystem_id` |
| `evaluation_subsystems` | `evaluation_subsystems_subsystem_cod_key` | Unique | `subsystem_cod` |
| `evaluation_type` | `evaluation_type_pkey` | PK | `evaluation_id` |
| `evaluation_type` | `evaluation_type_evaluation_abr_key` | Unique | `evaluation_abr` |
| `evaluation_type` | `evaluation_type_evaluation_name_key` | Unique | `evaluation_name` |
| `eval_system_grades` | `eval_system_grades_pkey` | PK | `grade_id` |
| `eval_system_grades` | `eval_system_grades_grades_name_key` | Unique | `grades_name` |

### Tablas de plan de estudios

| Tabla | Índice | Tipo | Columnas |
|-------|--------|------|----------|
| `study_plans` | `study_plans_pkey` | PK | `id` |
| `specialties` | `specialties_pkey` | PK | `id` |
| `specialties` | `specialties_name_key` | Unique | `name` |
| `plan_courses` | `plan_courses_pkey` | PK | `plan_id, course_id` |
| `course_prerequisites` | `course_prerequisites_pkey` | PK | `plan_id, course_id, prerequisite_id` |

### Tablas de usuarios

| Tabla | Índice | Tipo | Columnas |
|-------|--------|------|----------|
| `profiles` | `profiles_pkey` | PK | `id` |
| `profiles` | `uq_profiles_username_lower` | Unique | `lower(username)` WHERE `username IS NOT NULL AND btrim(username) <> ''` |
| `cycles` | `cycles_pkey` | PK | `cycle_id` |
| `cycles` | `cycles_cycle_code_key` | Unique | `cycle_code` |

### Tablas de seguridad

| Tabla | Índice | Tipo | Columnas |
|-------|--------|------|----------|
| `write_limits` | `write_limits_pkey` | PK | `ip_hash` |
