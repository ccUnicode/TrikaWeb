-- Migración: agregar planchas por evaluación y docente específico
-- Relaciona planchas con tipos de evaluación y distingue recursos generales o por docente.
-- Diseñada para ejecutarse sobre el schema original entregado al equipo.

begin;


alter table public.sheets
  add column if not exists evaluation_id integer,
  add column if not exists is_teacher_specific boolean default false;

update public.sheets
set is_teacher_specific = false
where is_teacher_specific is null;

alter table public.sheets
  alter column is_teacher_specific set default false,
  alter column is_teacher_specific set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.sheets'::regclass
      and conname = 'sheets_evaluation_id_fkey'
  ) then
    alter table public.sheets
      add constraint sheets_evaluation_id_fkey
      foreign key (evaluation_id)
      references public.evaluation_type(evaluation_id);
  end if;
end
$$;

-- Backfill de metadatos recuperado del estado actual.
update public.sheets as sheet
set
  evaluation_id = source.evaluation_id,
  is_teacher_specific = source.is_teacher_specific
from (
  values
    ('BMA03/PC1/2023-II.pdf', 1, false),
    ('BMA03/PC1/2020-II.pdf', 1, false),
    ('BMA03/EP/2023-III.pdf', 17, false),
    ('BMA03/ES/2023-I.pdf', 21, false),
    ('BMA02/EP/2020-II_Arambulo_Ostos__Carlos_Eduardo.pdf', 17, false),
    ('SI604/PC2/2026-I.pdf', 2, false),
    ('BMA03/PC1/2021-I.pdf', 1, false),
    ('BMA03/EP/2024-II.pdf', 17, false),
    ('BMA03/PC1/2024-II.pdf', 1, false),
    ('BMA03/PC1/2023-I.pdf', 1, false),
    ('BMA03/ES/2024-II.pdf', 21, false),
    ('BMA03/ES/2022-II.pdf', 21, false),
    ('BMA03/EP/2023-I.pdf', 17, false),
    ('BMA03/PC1/2023-III.pdf', 1, false),
    ('BMA03/EP/2022-II.pdf', 17, false),
    ('BMA03/PC3/2024-I.pdf', 3, false),
    ('BMA03/PC1/2022-III.pdf', 1, false),
    ('BMA03/EP/2022-III.pdf', 17, false),
    ('BMA03/PC2/2023-III.pdf', 2, false),
    ('BMA03/ES/2022-I.pdf', 21, false),
    ('BMA03/PC1/2022-II.pdf', 1, false),
    ('BMA03/EP/2022-I.pdf', 17, false),
    ('TE205/PC1/2022-III.pdf', null, true),
    ('BFI01/EP/2024-II.pdf', 17, true),
    ('BMA03/PC1/2022-I.pdf', 1, false),
    ('BMA03/PC1/2021-III.pdf', 1, false),
    ('BFI01/EF/2021-III_Canote_Fajardo__Percy_Victor.pdf', 18, false),
    ('BMA01/EF/2021-III_Cernades_Gomez__Jesus.pdf', 18, false),
    ('BMA03/PC1/2021-II.pdf', 1, false),
    ('BMA03/PC1/2020-I.pdf', 1, false),
    ('BMA03/EP/2024-I.pdf', 17, false),
    ('BMA03/PC4/2024-II.pdf', 4, false),
    ('BMA03/ES/2023-II.pdf', 21, false),
    ('BMA03/PC1/2024-I.pdf', 1, false)
) as source(exam_storage_path, evaluation_id, is_teacher_specific)
where sheet.exam_storage_path = source.exam_storage_path;


-- La unicidad anterior impedía almacenar una evaluación de docentes distintos.
drop index if exists public.uq_sheets_course_cycle_title;

create unique index if not exists uq_sheets_course_cycle_type_teacher
  on public.sheets (
    course_id,
    cycle,
    lower(exam_type),
    coalesce(lower(teacher_hint), '')
  );

commit;
