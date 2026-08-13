-- Migración 19
-- Agregar evaluación y docente específico a sheets
--
-- Agrega sheets.evaluation_id y realiza su backfill desde:
--   1. Un snapshot de rutas conocidas.
--   2. La abreviatura, el nombre normalizado o mapeos históricos.
--
-- Agrega sheets.teacher_id y realiza su backfill desde teacher_hint cuando
-- existe una coincidencia unívoca con teachers.full_name.
--
-- Las planchas históricas específicas cuyo docente todavía no está
-- registrado conservan teacher_id = NULL y teacher_hint como respaldo.
-- Para nuevas subidas, el backend debe seguir exigiendo teacher_id cuando
-- is_teacher_specific = true.

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
  add column if not exists is_teacher_specific boolean;

-- ---------------------------------------------------------------------------
-- 3. Validar catálogo de evaluaciones antes del backfill
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
end
$$;

-- ---------------------------------------------------------------------------
-- 4. Backfill exacto recuperado del estado conocido
-- ---------------------------------------------------------------------------

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

-- Mapeos históricos explícitos.
with evaluation_mapping (
  historical_exam_type,
  evaluation_abr
) as (
  values
    ('PARCIAL', 'EP'),
    ('FINAL', 'EF'),
    ('SUSTITUTORIO', 'ES'),
    ('ENTRADA', 'PE')
)
update public.sheets as sheet
set evaluation_id = evaluation.evaluation_id
from evaluation_mapping as mapping
join public.evaluation_type as evaluation
  on upper(btrim(evaluation.evaluation_abr)) =
     mapping.evaluation_abr
where sheet.evaluation_id is null
  and upper(btrim(sheet.exam_type)) =
      mapping.historical_exam_type;

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
-- Se intenta relacionar teacher_hint con teachers.full_name.
-- Solo se asigna teacher_id cuando existe una coincidencia unívoca.
--
-- Si el docente todavía no está registrado, teacher_id permanece NULL.

with normalized_teachers as (
  select
    teacher.id,
    lower(
      regexp_replace(
        regexp_replace(
          btrim(teacher.full_name),
          '[_,.-]+',
          ' ',
          'g'
        ),
        '[[:space:]]+',
        ' ',
        'g'
      )
    ) as normalized_name
  from public.teachers as teacher
  where nullif(btrim(teacher.full_name), '') is not null
),
normalized_sheets as (
  select
    sheet.id,
    lower(
      regexp_replace(
        regexp_replace(
          btrim(sheet.teacher_hint),
          '[_,.-]+',
          ' ',
          'g'
        ),
        '[[:space:]]+',
        ' ',
        'g'
      )
    ) as normalized_hint
  from public.sheets as sheet
  where sheet.teacher_id is null
    and nullif(btrim(sheet.teacher_hint), '') is not null
),
teacher_candidates as (
  select
    sheet.id as sheet_id,
    min(teacher.id) as teacher_id,
    count(*) as matches
  from normalized_sheets as sheet
  join normalized_teachers as teacher
    on teacher.normalized_name = sheet.normalized_hint
  where sheet.normalized_hint not in (
    'todos',
    'todos los profesores'
  )
  group by sheet.id
)
update public.sheets as sheet
set teacher_id = candidate.teacher_id
from teacher_candidates as candidate
where sheet.id = candidate.sheet_id
  and candidate.matches = 1;

-- Determinar si cada plancha es general o específica.
--
-- Una plancha es específica cuando:
-- - ya tiene teacher_id, o
-- - conserva un teacher_hint concreto.
--
-- "Todos" y "Todos los profesores" representan planchas generales.

update public.sheets
set is_teacher_specific =
  case
    when teacher_id is not null then true

    when nullif(btrim(teacher_hint), '') is not null
      and lower(btrim(teacher_hint)) not in (
        'todos',
        'todos los profesores'
      )
      then true

    else false
  end;

-- Las planchas específicas sin docente registrado no bloquean la migración.

do $$
declare
  missing_count bigint;
begin
  select count(*)
  into missing_count
  from public.sheets
  where is_teacher_specific = true
    and teacher_id is null;

  if missing_count > 0 then
    raise notice
      '% plancha(s) específica(s) conservarán teacher_id NULL porque el docente aún no está registrado.',
      missing_count;
  end if;
end
$$;

alter table public.sheets
  alter column is_teacher_specific set default false,
  alter column is_teacher_specific set not null;

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

-- teacher_id continúa siendo nullable.

-- ---------------------------------------------------------------------------
-- 8. Aplicar restricciones de consistencia
-- ---------------------------------------------------------------------------

alter table public.sheets
  alter column evaluation_id set not null;

alter table public.sheets
  drop constraint if exists
    sheets_teacher_specific_consistency_check;

alter table public.sheets
  add constraint sheets_teacher_specific_consistency_check
  check (
    (
      is_teacher_specific = false
      and teacher_id is null
    )
    or
    (
      is_teacher_specific = true
      and (
        teacher_id is not null
        or (
          nullif(btrim(teacher_hint), '') is not null
          and lower(btrim(teacher_hint)) not in (
            'todos',
            'todos los profesores'
          )
        )
      )
    )
  );

-- ---------------------------------------------------------------------------
-- 9. Validar duplicados antes de crear índices únicos
-- ---------------------------------------------------------------------------

do $$
begin
  -- Planchas generales.
  if exists (
    select 1
    from public.sheets
    where is_teacher_specific = false
    group by
      course_id,
      cycle,
      evaluation_id
    having count(*) > 1
  ) then
    raise exception
      'Existen planchas generales duplicadas para el mismo curso, ciclo y evaluación.';
  end if;

  -- Planchas específicas con teacher_id.
  if exists (
    select 1
    from public.sheets
    where is_teacher_specific = true
      and teacher_id is not null
    group by
      course_id,
      cycle,
      evaluation_id,
      teacher_id
    having count(*) > 1
  ) then
    raise exception
      'Existen planchas específicas duplicadas para el mismo curso, ciclo, evaluación y teacher_id.';
  end if;

  -- Planchas específicas cuyo profesor todavía no está registrado.
  if exists (
    select 1
    from public.sheets
    where is_teacher_specific = true
      and teacher_id is null
      and nullif(btrim(teacher_hint), '') is not null
    group by
      course_id,
      cycle,
      evaluation_id,
      lower(btrim(teacher_hint))
    having count(*) > 1
  ) then
    raise exception
      'Existen planchas específicas sin teacher_id duplicadas para el mismo curso, ciclo, evaluación y teacher_hint.';
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- 10. Reemplazar índices antiguos
-- ---------------------------------------------------------------------------

drop index if exists
  public.uq_sheets_course_cycle_title;

drop index if exists
  public.uq_sheets_course_cycle_type_teacher;

drop index if exists
  public.uq_sheets_course_cycle_evaluation_teacher;

drop index if exists
  public.uq_sheets_general_course_cycle_evaluation;

drop index if exists
  public.uq_sheets_teacher_course_cycle_evaluation;

drop index if exists
  public.uq_sheets_unresolved_teacher_course_cycle_evaluation;

-- Una única plancha general por curso, ciclo y evaluación.

create unique index
  uq_sheets_general_course_cycle_evaluation
on public.sheets (
  course_id,
  cycle,
  evaluation_id
)
where is_teacher_specific = false;

-- Una única plancha por docente registrado.

create unique index
  uq_sheets_teacher_course_cycle_evaluation
on public.sheets (
  course_id,
  cycle,
  evaluation_id,
  teacher_id
)
where is_teacher_specific = true
  and teacher_id is not null;

-- Compatibilidad histórica:
-- mientras un docente no exista en teachers, teacher_hint funciona como
-- identificador temporal para evitar duplicados.

create unique index
  uq_sheets_unresolved_teacher_course_cycle_evaluation
on public.sheets (
  course_id,
  cycle,
  evaluation_id,
  lower(btrim(teacher_hint))
)
where is_teacher_specific = true
  and teacher_id is null
  and nullif(btrim(teacher_hint), '') is not null;

create index if not exists
  idx_sheets_evaluation_id
on public.sheets (evaluation_id);

create index if not exists
  idx_sheets_teacher_id
on public.sheets (teacher_id)
where teacher_id is not null;

commit;