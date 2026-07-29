-- Migración: agregar evaluación y docente específico a sheets
-- 
-- Agrega sheets.evaluation_id y realiza su backfill desde exam_type.
-- Agrega sheets.teacher_id y realiza su backfill desde teacher_hint.
-- Conserva teacher_hint únicamente como texto informativo.
-- Reemplaza el índice basado en nombres por identificadores estables.

begin;

-- Validar dependencias

do $$
begin
  if to_regclass('public.evaluation_type') is null then
    raise exception
      'La tabla public.evaluation_type no existe. Ejecuta primero la migración de catálogos de evaluación.';
  end if;

  if to_regclass('public.teachers') is null then
    raise exception
      'La tabla public.teachers no existe.';
  end if;
end;
$$;

-- Agregar las columnas necesarias

alter table public.sheets
  add column if not exists evaluation_id integer,
  add column if not exists teacher_id bigint,
  add column if not exists is_teacher_specific boolean;

update public.sheets
set is_teacher_specific = false
where is_teacher_specific is null;

alter table public.sheets
  alter column is_teacher_specific set default false,
  alter column is_teacher_specific set not null;

-- Validar que las abreviaturas de evaluación sean únicas

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
end;
$$;

-- Backfill de evaluation_id

update public.sheets as sheet
set evaluation_id = evaluation.evaluation_id
from public.evaluation_type as evaluation
where sheet.evaluation_id is null
  and nullif(btrim(sheet.exam_type), '') is not null
  and upper(btrim(evaluation.evaluation_abr)) =
      upper(btrim(sheet.exam_type));

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
      'No se pudo asignar evaluation_id a % plancha(s). Revisa sheets.exam_type y evaluation_type.evaluation_abr.',
      missing_count;
  end if;
end;
$$;

-- Backfill de teacher_id

/*
 * teacher_hint se utiliza solamente para localizar al docente durante
 * la migración. Después del backfill, teacher_id será la identidad
 * estable utilizada por consultas, relaciones e índices.
 */
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

-- Detener la migración si una plancha específica no pudo asociarse.
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
      'No se pudo asignar teacher_id a % plancha(s) específicas. Revisa teacher_hint y teachers.full_name.',
      missing_count;
  end if;
end;
$$;

-- La bandera queda derivada de la relación real con el docente.
update public.sheets
set is_teacher_specific = teacher_id is not null;

-- 6. Crear claves foráneas

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

-- 7. Aplicar restricciones de consistencia

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

-- 8. Reemplazar índices antiguos basados en texto

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