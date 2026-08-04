begin;

-- ============================================================================
-- 1. Validar que los catálogos requeridos ya existan
-- ============================================================================

do $$
begin
  if not exists (
    select 1
    from public.evaluation_systems
    where btrim(system_cod) = 'G'
  ) then
    raise exception
      'No existe el sistema de evaluación G. Ejecuta primero add_evaluation_catalogs.sql';
  end if;

  if not exists (
    select 1
    from public.evaluation_systems
    where btrim(system_cod) = 'F'
  ) then
    raise exception
      'No existe el sistema de evaluación F. Ejecuta primero add_evaluation_catalogs.sql';
  end if;

  if not exists (
    select 1
    from public.evaluation_subsystems
    where subsystem_cod = 'S4'
  ) then
    raise exception
      'No existe el subsistema S4. Ejecuta primero add_evaluation_catalogs.sql';
  end if;

  if not exists (
    select 1
    from public.evaluation_subsystems
    where subsystem_cod = 'S10'
  ) then
    raise exception
      'No existe el subsistema S10. Ejecuta primero add_evaluation_catalogs.sql';
  end if;

  if not exists (
    select 1
    from public.evaluation_type
    where upper(evaluation_abr) = 'PC1'
  ) then
    raise exception
      'No existe la evaluación PC1. Ejecuta primero add_evaluation_catalogs.sql';
  end if;
end;
$$;


-- ============================================================================
-- 2. Registrar los cursos
-- ============================================================================

with seed_courses (
  code,
  name,
  credits,
  summary,
  system_cod,
  subsystem_cod
) as (
  values
    (
      'BMA01',
      'Cálculo Diferencial',
      5,
      'Curso de fundamentos del cálculo diferencial y sus aplicaciones.',
      'G',
      'S4'
    ),
    (
      'BMA02',
      'Cálculo Integral',
      5,
      'Curso de fundamentos del cálculo integral y sus aplicaciones.',
      'G',
      'S4'
    ),
    (
      'BFI01',
      'Física I',
      5,
      'Curso introductorio de mecánica, movimiento y fundamentos de física.',
      'F',
      'S10'
    )
)
insert into public.courses (
  code,
  name,
  credits,
  summary,
  system_id,
  subsystem_id,
  status,
  is_hidden
)
select
  seed.code,
  seed.name,
  seed.credits,
  seed.summary,
  system.system_id,
  subsystem.subsystem_id,
  'COMPLETO',
  false
from seed_courses as seed
join public.evaluation_systems as system
  on btrim(system.system_cod) = seed.system_cod
join public.evaluation_subsystems as subsystem
  on subsystem.subsystem_cod = seed.subsystem_cod
on conflict do nothing;


-- Actualizar los registros si ya habían sido insertados por un seed anterior.
with seed_courses (
  code,
  name,
  credits,
  summary,
  system_cod,
  subsystem_cod
) as (
  values
    (
      'BMA01',
      'Cálculo Diferencial',
      5,
      'Curso de fundamentos del cálculo diferencial y sus aplicaciones.',
      'G',
      'S4'
    ),
    (
      'BMA02',
      'Cálculo Integral',
      5,
      'Curso de fundamentos del cálculo integral y sus aplicaciones.',
      'G',
      'S4'
    ),
    (
      'BFI01',
      'Física I',
      5,
      'Curso introductorio de mecánica, movimiento y fundamentos de física.',
      'F',
      'S10'
    )
)
update public.courses as course
set
  name = seed.name,
  credits = seed.credits,
  summary = seed.summary,
  system_id = system.system_id,
  subsystem_id = subsystem.subsystem_id,
  status = 'COMPLETO',
  is_hidden = false
from seed_courses as seed
join public.evaluation_systems as system
  on btrim(system.system_cod) = seed.system_cod
join public.evaluation_subsystems as subsystem
  on subsystem.subsystem_cod = seed.subsystem_cod
where upper(course.code) = seed.code;


-- ============================================================================
-- 3. Asociar evaluaciones a los cursos
-- ============================================================================

with course_evaluation_seed (
  course_code,
  evaluation_abr
) as (
  values
    -- Cálculo Diferencial
    ('BMA01', 'PC1'),
    ('BMA01', 'PC2'),
    ('BMA01', 'PC3'),
    ('BMA01', 'PC4'),
    ('BMA01', 'EP'),
    ('BMA01', 'EF'),
    ('BMA01', 'ES'),
    ('BMA01', 'PE'),

    -- Cálculo Integral
    ('BMA02', 'PC1'),
    ('BMA02', 'PC2'),
    ('BMA02', 'PC3'),
    ('BMA02', 'PC4'),
    ('BMA02', 'EP'),
    ('BMA02', 'EF'),
    ('BMA02', 'ES'),
    ('BMA02', 'PE'),

    -- Física I
    ('BFI01', 'PC1'),
    ('BFI01', 'PC2'),
    ('BFI01', 'PC3'),
    ('BFI01', 'PC4'),
    ('BFI01', 'PC5'),
    ('BFI01', 'LAB1'),
    ('BFI01', 'LAB2'),
    ('BFI01', 'LAB3'),
    ('BFI01', 'LAB4'),
    ('BFI01', 'LAB5'),
    ('BFI01', 'EP'),
    ('BFI01', 'EF'),
    ('BFI01', 'ES'),
    ('BFI01', 'PE')
)
insert into public.course_evaluations (
  course_id,
  evaluation_id
)
select
  course.id,
  evaluation.evaluation_id
from course_evaluation_seed as seed
join public.courses as course
  on upper(course.code) = seed.course_code
join public.evaluation_type as evaluation
  on upper(evaluation.evaluation_abr) = seed.evaluation_abr
on conflict do nothing;


-- ============================================================================
-- 4. Registrar docentes de prueba
-- ============================================================================

insert into public.teachers (
  full_name,
  bio
)
values
  (
    'Carlos Eduardo Arámbulo Ostos',
    'Información del docente pendiente de actualización.'
  ),
  (
    'Percy Victor Cañote Fajardo',
    'Información del docente pendiente de actualización.'
  ),
  (
    'Jesús Cernades Gomez',
    'Información del docente pendiente de actualización.'
  )
on conflict do nothing;


-- ============================================================================
-- 5. Registrar el ciclo utilizado por la plancha de prueba
-- ============================================================================

insert into public.cycles (
  cycle_code,
  year,
  term
)
values (
  '2024-II',
  2024,
  'II'
)
on conflict (cycle_code) do update
set
  year = excluded.year,
  term = excluded.term;


-- ============================================================================
-- 6. Registrar una plancha de prueba para BMA02
-- ============================================================================

insert into public.sheets (
  course_id,
  cycle,
  exam_type,
  evaluation_id,
  exam_storage_path,
  solution_kind,
  solution_storage_path,
  solution_video_url,
  teacher_hint,
  is_teacher_specific,
  is_hidden
)
select
  course.id,
  '2024-II',
  evaluation.evaluation_abr,
  evaluation.evaluation_id,
  'BMA02/PC1/2024-II.pdf',
  'pdf',
  'BMA02/PC1/2024-II.pdf',
  null,
  null,
  false,
  false
from public.courses as course
join public.evaluation_type as evaluation
  on upper(evaluation.evaluation_abr) = 'PC1'
where upper(course.code) = 'BMA02'
on conflict do nothing;


commit;