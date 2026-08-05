-- Migración 19
-- Agregar evaluación y docente específico a sheets
--
-- Agrega sheets.evaluation_id y realiza su backfill desde:
--   1. Un snapshot de rutas conocidas.
--   2. La abreviatura o el nombre normalizado de evaluation_type.
--
-- Agrega sheets.teacher_id y realiza su backfill desde teacher_hint.
-- Conserva teacher_hint únicamente como texto informativo.
-- Reemplaza los índices basados en texto por identificadores estables.

begin;

-- ---------------------------------------------------------------------------
-- 1. Validar dependencias
-- ---------------------------------------------------------------------------

do $$
begin
  if to_regclass('public.sheets') is null then
    raise exception
      'La tabla public.sheets no existe.';
  end if;

  if to_regclass('public.evaluation_type') is null then
    raise exception
      'La tabla public.evaluation_type no existe. Ejecuta primero la migración de catálogos de evaluación.';
  end if;

  if to_regclass('public.teachers') is null then
    raise exception
      'La tabla public.teachers no existe.';
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- 2. Agregar columnas
-- ---------------------------------------------------------------------------

alter table public.sheets
  add column if not exists evaluation_id integer,
  add column if not exists teacher_id bigint,
  add column if not exists is_teacher_specific boolean default false;

update public.sheets
set is_teacher_specific = false
where is_teacher_specific is null;

alter table public.sheets
  alter column is_teacher_specific set default false,
  alter column is_teacher_specific set not null;

-- ---------------------------------------------------------------------------
-- 3. Validar catálogos antes del backfill
-- ---------------------------------------------------------------------------

do $$
begin
  if exists (
    select 1
    from public.evaluation_type
    where nullif(btrim(evaluation_abr), '') is not null
    group by upper(btrim(evaluation_abr))
    having count(*) > 1
  ) then
    raise exception
      'Existen abreviaturas duplicadas en public.evaluation_type; no se puede realizar un backfill seguro.';
  end if;

  if exists (
    select 1
    from public.teachers
    where nullif(btrim(full_name), '') is not null
    group by lower(btrim(full_name))
    having count(*) > 1
  ) then
    raise exception
      'Existen nombres de docentes duplicados en public.teachers; no se puede realizar un backfill seguro.';
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- 4. Backfill exacto recuperado del estado conocido
-- ---------------------------------------------------------------------------
--
-- Este bloque conserva los mapeos históricos que no siempre pueden deducirse
-- únicamente desde sheets.exam_type.
--
-- No sobrescribe evaluation_id ya configurados.

update public.sheets as sheet
set evaluation_id = source.evaluation_id
from (
  values
    ('BMA03/PC1/2023-II.pdf', 1),
    ('BMA03/PC1/2020-II.pdf', 1),
    ('BMA03/EP/2023-III.pdf', 17),
    ('BMA03/ES/2023-I.pdf', 21),
    ('BMA02/EP/2020-II_Arambulo_Ostos__Carlos_Eduardo.pdf', 17),
    ('SI604/PC2/2026-I.pdf', 2),
    ('BMA03/PC1/2021-I.pdf', 1),
    ('BMA03/EP/2024-II.pdf', 17),
    ('BMA03/PC1/2024-II.pdf', 1),
    ('BMA03/PC1/2023-I.pdf', 1),
    ('BMA03/ES/2024-II.pdf', 21),
    ('BMA03/ES/2022-II.pdf', 21),
    ('BMA03/EP/2023-I.pdf', 17),
    ('BMA03/PC1/2023-III.pdf', 1),
    ('BMA03/EP/2022-II.pdf', 17),
    ('BMA03/PC3/2024-I.pdf', 3),
    ('BMA03/PC1/2022-III.pdf', 1),
    ('BMA03/EP/2022-III.pdf', 17),
    ('BMA03/PC2/2023-III.pdf', 2),
    ('BMA03/ES/2022-I.pdf', 21),
    ('BMA03/PC1/2022-II.pdf', 1),
    ('BMA03/EP/2022-I.pdf', 17),
    ('BMA03/PC1/2022-I.pdf', 1),
    ('BMA03/PC1/2021-III.pdf', 1),
    ('BFI01/EF/2021-III_Canote_Fajardo__Percy_Victor.pdf', 18),
    ('BMA01/EF/2021-III_Cernades_Gomez__Jesus.pdf', 18),
    ('BMA03/PC1/2021-II.pdf', 1),
    ('BMA03/PC1/2020-I.pdf', 1),
    ('BMA03/EP/2024-I.pdf', 17),
    ('BMA03/PC4/2024-II.pdf', 4),
    ('BMA03/ES/2023-II.pdf', 21),
    ('BMA03/PC1/2024-I.pdf', 1),
    ('BFI01/EP/2024-II.pdf', 17)
) as source(exam_storage_path, evaluation_id)
where sheet.evaluation_id is null
  and sheet.exam_storage_path = source.exam_storage_path;

-- ---------------------------------------------------------------------------
-- 5. Backfill general de evaluation_id
-- ---------------------------------------------------------------------------
--
-- Primero compara con evaluation_abr.
-- También compara con evaluation_name, ignorando prefijos como
-- "Examen" o "Evaluación". Esto permite resolver casos como:
--   sheets.exam_type = 'Parcial'
--   evaluation_type.evaluation_name = 'Examen Parcial'
--
-- Solo se actualizan coincidencias unívocas.

with evaluation_candidates as (
  select
    sheet.id as sheet_id,
    min(evaluation.evaluation_id) as evaluation_id,
    count(*) as matches
  from public.sheets as sheet
  join public.evaluation_type as evaluation
    on (
      upper(btrim(evaluation.evaluation_abr)) =
        upper(btrim(sheet.exam_type))
      or
      lower(
        regexp_replace(
          btrim(evaluation.evaluation_name),
          '^(examen|evaluación|evaluacion)[[:space:]]+',
          '',
          'i'
        )
      ) =
      lower(
        regexp_replace(
          btrim(sheet.exam_type),
          '^(examen|evaluación|evaluacion)[[:space:]]+',
          '',
          'i'
        )
      )
    )
  where sheet.evaluation_id is null
    and nullif(btrim(sheet.exam_type), '') is not null
    and (
      nullif(btrim(evaluation.evaluation_abr), '') is not null
      or nullif(btrim(evaluation.evaluation_name), '') is not null
    )
  group by sheet.id
)
update public.sheets as sheet
set evaluation_id = candidate.evaluation_id
from evaluation_candidates as candidate
where sheet.id = candidate.sheet_id
  and candidate.matches = 1;

-- No continuar si alguna plancha quedó sin evaluación.

do $$
declare
  missing_count bigint;
begin
  select count(*)
  into missing_count
  from public.sheets
  where evaluation_id is null;

  if missing_count > 0 then
    raise exception
      'No se pudo asignar evaluation_id a % plancha(s). Revisa sheets.exam_type, sheets.exam_storage_path y public.evaluation_type.',
      missing_count;
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- 6. Backfill de teacher_id
-- ---------------------------------------------------------------------------
--
-- teacher_hint se utiliza solamente para localizar al docente durante
-- la migración. Después del backfill, teacher_id será la identidad
-- estable utilizada por consultas, relaciones e índices.

update public.sheets as sheet
set teacher_id = teacher.id
from public.teachers as teacher
where sheet.teacher_id is null
  and sheet.teacher_hint is not null
  and nullif(btrim(sheet.teacher_hint), '') is not null
  and lower(btrim(sheet.teacher_hint)) not in (
    'todos los profesores',
    'todos'
  )
  and lower(btrim(teacher.full_name)) =
      lower(btrim(sheet.teacher_hint));

-- Detener la migración si una plancha marcada como específica o con un
-- teacher_hint concreto no pudo asociarse a un docente.

do $$
declare
  missing_count bigint;
begin
  select count(*)
  into missing_count
  from public.sheets
  where teacher_id is null
    and (
      is_teacher_specific = true
      or (
        teacher_hint is not null
        and nullif(btrim(teacher_hint), '') is not null
        and lower(btrim(teacher_hint)) not in (
          'todos los profesores',
          'todos'
        )
      )
    );

  if missing_count > 0 then
    raise exception
      'No se pudo asignar teacher_id a % plancha(s) específicas. Revisa sheets.teacher_hint y teachers.full_name.',
      missing_count;
  end if;
end
$$;

-- La bandera queda derivada de la relación real con el docente.

update public.sheets
set is_teacher_specific = teacher_id is not null;

-- ---------------------------------------------------------------------------
-- 7. Crear claves foráneas
-- ---------------------------------------------------------------------------

alter table public.sheets
  drop constraint if exists sheets_evaluation_id_fkey;

alter table public.sheets
  add constraint sheets_evaluation_id_fkey
  foreign key (evaluation_id)
  references public.evaluation_type(evaluation_id)
  on delete restrict;

alter table public.sheets
  drop constraint if exists sheets_teacher_id_fkey;

alter table public.sheets
  add constraint sheets_teacher_id_fkey
  foreign key (teacher_id)
  references public.teachers(id)
  on delete restrict;

-- ---------------------------------------------------------------------------
-- 8. Aplicar restricciones de consistencia
-- ---------------------------------------------------------------------------

alter table public.sheets
  alter column evaluation_id set not null;

alter table public.sheets
  drop constraint if exists sheets_teacher_specific_consistency_check;

alter table public.sheets
  add constraint sheets_teacher_specific_consistency_check
  check (
    (
      is_teacher_specific = true
      and teacher_id is not null
    )
    or
    (
      is_teacher_specific = false
      and teacher_id is null
    )
  );

-- ---------------------------------------------------------------------------
-- 9. Reemplazar índices antiguos basados en texto
-- ---------------------------------------------------------------------------

drop index if exists public.uq_sheets_course_cycle_title;
drop index if exists public.uq_sheets_course_cycle_type_teacher;
drop index if exists public.uq_sheets_course_cycle_evaluation_teacher;

/*
 * Para una plancha general teacher_id es NULL. COALESCE lo convierte en
 * cero para que PostgreSQL también detecte duplicados entre planchas generales.
 */
create unique index uq_sheets_course_cycle_evaluation_teacher
  on public.sheets (
    course_id,
    cycle,
    evaluation_id,
    coalesce(teacher_id, 0::bigint)
  );

create index if not exists idx_sheets_evaluation_id
  on public.sheets (evaluation_id);

create index if not exists idx_sheets_teacher_id
  on public.sheets (teacher_id)
  where teacher_id is not null;

commit;
