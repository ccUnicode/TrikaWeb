-- Migración: agregar catálogos de evaluación y ciclos académicos
-- Crea sistemas, subsistemas, tipos de evaluación, ponderaciones y ciclos.
-- Diseñada para ejecutarse sobre el schema original entregado al equipo.

begin;


create table if not exists public.evaluation_systems (
  system_id serial primary key,
  system_cod char(1) not null unique,
  system_description text not null,
  requires_subsystem boolean,
  formula text
);

create table if not exists public.evaluation_subsystems (
  subsystem_id serial primary key,
  subsystem_cod varchar(4) not null unique,
  practices_quantity integer not null,
  constraint evaluation_subsystems_practices_quantity_check
    check (practices_quantity > 0)
);

create table if not exists public.evaluation_type (
  evaluation_id serial primary key,
  evaluation_name text unique,
  evaluation_abr text unique,
  evaluation_category text,
  constraint evaluation_type_evaluation_category_check
    check (evaluation_category in (
      'PRACTICA', 'EXAMEN', 'TRABAJO',
      'EVALUACION', 'LABORATORIO', 'PRUEBA'
    ))
);

create table if not exists public.eval_system_grades (
  grade_id serial primary key,
  grades_name text not null unique
);

create table if not exists public.grade_evaluation_type (
  grade_id integer references public.eval_system_grades(grade_id),
  evaluation_id integer references public.evaluation_type(evaluation_id)
);

create table if not exists public.system_grades_consider (
  system_id integer not null references public.evaluation_systems(system_id),
  grade_id integer not null references public.eval_system_grades(grade_id),
  weight integer not null check (weight >= 0)
);

create table if not exists public.cycles (
  cycle_id bigserial primary key,
  cycle_code varchar(10) not null unique,
  year integer not null,
  term varchar(3) not null,
  constraint cycles_term_check check (term in ('I', 'II', 'III'))
);

-- Datos de referencia recuperados del estado actual.
insert into public.evaluation_systems (
  system_id,
  system_cod,
  system_description,
  requires_subsystem,
  formula
)
values
  (1, 'A', 'Promedio de trabajos calificados (1), examen oral (1)', true, null),
  (3, 'C', 'Promedio de prácticas (2), examen parcial (2), examen final (3)', true, null),
  (5, 'E', 'Promedio de trabajos calificados (2), promedio de prácticas (1)', true, null),
  (8, 'H', 'Examen parcial (1), examen final (2), promedio de prácticas o trabajos calificados (2)', true, null),
  (9, 'I', 'Examen parcial (1), examen final (1), promedio de prácticas o trabajos calificados (2)', true, null),
  (10, 'J', 'Examen parcial (1), examen final (1)', false, null),
  (11, 'M', 'Examen parcial (2), examen final (3), promedio de prácticas o trabajos calificados (1)', false, null),
  (12, 'N', 'Evaluación del proceso de aprendizaje (1), trabajo final (2)', false, null),
  (2, 'B', 'Examen parcial (1), examen final (2)', false, 'PF = (EP + 2×EF) / 3'),
  (4, 'D', 'Promedio de prácticas o trabajos calificados (1)', true, 'PF = PP'),
  (6, 'F', 'Examen parcial (1), examen final (2), promedio de prácticas o trabajos calificados (1)', true, 'PF = (EP + 2×EF + PP) / 4'),
  (7, 'G', 'Examen parcial (1), examen final (1), promedio de prácticas o trabajos calificados (1)', true, 'PF = (EP + EF + PP) / 3')
on conflict (system_id) do update
set
  system_cod = excluded.system_cod,
  system_description = excluded.system_description,
  requires_subsystem = excluded.requires_subsystem,
  formula = excluded.formula;

insert into public.evaluation_subsystems (
  subsystem_id,
  subsystem_cod,
  practices_quantity
)
values
  (1, 'S4', 4),
  (2, 'S5', 5),
  (3, 'S6', 6),
  (4, 'S7', 7),
  (5, 'S8', 8),
  (6, 'S9', 9),
  (7, 'S10', 10),
  (8, 'S11', 11),
  (9, 'S12', 12),
  (10, 'S3', 3)
on conflict (subsystem_id) do update
set
  subsystem_cod = excluded.subsystem_cod,
  practices_quantity = excluded.practices_quantity;

insert into public.evaluation_type (
  evaluation_id,
  evaluation_name,
  evaluation_abr,
  evaluation_category
)
values
  (1, 'Práctica Calificada 1', 'PC1', 'PRACTICA'),
  (2, 'Práctica Calificada 2', 'PC2', 'PRACTICA'),
  (3, 'Práctica Calificada 3', 'PC3', 'PRACTICA'),
  (4, 'Práctica Calificada 4', 'PC4', 'PRACTICA'),
  (5, 'Práctica Calificada 5', 'PC5', 'PRACTICA'),
  (6, 'Laboratorio 1', 'LAB1', 'LABORATORIO'),
  (7, 'Laboratorio 2', 'LAB2', 'LABORATORIO'),
  (8, 'Laboratorio 3', 'LAB3', 'LABORATORIO'),
  (9, 'Laboratorio 4', 'LAB4', 'LABORATORIO'),
  (10, 'Laboratorio 5', 'LAB5', 'LABORATORIO'),
  (11, 'Laboratorio 6', 'LAB6', 'LABORATORIO'),
  (12, 'Laboratorio 7', 'LAB7', 'LABORATORIO'),
  (13, 'Laboratorio 8', 'LAB8', 'LABORATORIO'),
  (14, 'Monografía 1', 'MONO1', 'TRABAJO'),
  (15, 'Monografía 2', 'MONO2', 'TRABAJO'),
  (16, 'Trabajo Final', 'TF', 'TRABAJO'),
  (17, 'Examen Parcial', 'EP', 'EXAMEN'),
  (18, 'Examen Final', 'EF', 'EXAMEN'),
  (19, 'Examen Oral', 'EO', 'EXAMEN'),
  (20, 'Evaluación del proceso de aprendizaje', 'EPA', 'EVALUACION'),
  (21, 'Examen Sustitutorio', 'ES', 'EXAMEN'),
  (22, 'Prueba de Entrada', 'PE', 'PRUEBA'),
  (24, 'Monografía 3', 'MONO3', 'TRABAJO'),
  (25, 'Monografía 4', 'MONO4', 'TRABAJO')
on conflict (evaluation_id) do update
set
  evaluation_name = excluded.evaluation_name,
  evaluation_abr = excluded.evaluation_abr,
  evaluation_category = excluded.evaluation_category;

insert into public.eval_system_grades (
  grade_id,
  grades_name
)
values
  (1, 'Examen final'),
  (2, 'Examen parcial'),
  (3, 'Promedio de trabajos calificados'),
  (4, 'Promedio de prácticas calificadas'),
  (5, 'Promedio de prácticas o trabajos calificados'),
  (6, 'Evaluación del proceso de aprendizaje'),
  (7, 'Trabajo final'),
  (8, 'Examen oral')
on conflict (grade_id) do update
set grades_name = excluded.grades_name;

insert into public.grade_evaluation_type (
  grade_id,
  evaluation_id
)
select
  source.grade_id,
  source.evaluation_id
from (
  values
    (1, 18),
    (2, 17),
    (3, 14),
    (3, 15),
    (4, 1),
    (4, 2),
    (4, 3),
    (4, 4),
    (4, 5),
    (4, 6),
    (4, 7),
    (4, 8),
    (4, 9),
    (4, 10),
    (4, 11),
    (4, 12),
    (4, 13),
    (5, 1),
    (5, 2),
    (5, 3),
    (5, 4),
    (5, 5),
    (5, 6),
    (5, 7),
    (5, 8),
    (5, 9),
    (5, 10),
    (5, 11),
    (5, 12),
    (5, 13),
    (5, 14),
    (5, 15),
    (6, 20),
    (7, 16),
    (8, 19),
    (3, 24),
    (3, 25),
    (5, 24),
    (5, 25)
) as source(grade_id, evaluation_id)
where not exists (
  select 1
  from public.grade_evaluation_type as existing
  where existing.grade_id = source.grade_id
    and existing.evaluation_id = source.evaluation_id
);

insert into public.system_grades_consider (
  system_id,
  grade_id,
  weight
)
select
  source.system_id,
  source.grade_id,
  source.weight
from (
  values
    (1, 3, 1),
    (1, 8, 1),
    (2, 1, 2),
    (2, 2, 1),
    (3, 4, 2),
    (3, 2, 2),
    (3, 1, 3),
    (4, 5, 1),
    (5, 3, 2),
    (5, 4, 1),
    (6, 2, 1),
    (6, 1, 2),
    (6, 5, 1),
    (7, 2, 1),
    (7, 1, 1),
    (7, 5, 1),
    (8, 2, 1),
    (8, 1, 2),
    (8, 5, 2),
    (9, 2, 1),
    (9, 1, 1),
    (9, 5, 2),
    (10, 2, 1),
    (10, 1, 1),
    (11, 2, 2),
    (11, 1, 3),
    (11, 5, 1),
    (12, 6, 1),
    (12, 7, 2)
) as source(system_id, grade_id, weight)
where not exists (
  select 1
  from public.system_grades_consider as existing
  where existing.system_id = source.system_id
    and existing.grade_id = source.grade_id
    and existing.weight = source.weight
);

insert into public.cycles (
  cycle_id,
  cycle_code,
  year,
  term
)
values
  (1, '2022-I', 2022, 'I'),
  (2, '2022-II', 2022, 'II'),
  (3, '2022-III', 2022, 'III'),
  (4, '2023-I', 2023, 'I'),
  (5, '2023-II', 2023, 'II'),
  (6, '2023-III', 2023, 'III'),
  (7, '2024-I', 2024, 'I'),
  (8, '2024-II', 2024, 'II'),
  (9, '2024-III', 2024, 'III'),
  (10, '2025-I', 2025, 'I'),
  (11, '2025-II', 2025, 'II'),
  (12, '2025-III', 2025, 'III'),
  (14, '2026-III', 2026, 'III'),
  (15, '2021-III', 2021, 'III'),
  (16, '2020-II', 2020, 'II'),
  (17, '2021-II', 2021, 'II'),
  (18, '2021-I', 2021, 'I'),
  (19, '2020-I', 2020, 'I'),
  (13, '2026-I', 2026, 'I')
on conflict (cycle_id) do update
set
  cycle_code = excluded.cycle_code,
  year = excluded.year,
  term = excluded.term;

-- ============================================================

select setval(
  pg_get_serial_sequence('public.evaluation_systems', 'system_id'),
  coalesce((select max(system_id) from public.evaluation_systems), 1),
  exists (select 1 from public.evaluation_systems)
);

select setval(
  pg_get_serial_sequence('public.evaluation_subsystems', 'subsystem_id'),
  coalesce((select max(subsystem_id) from public.evaluation_subsystems), 1),
  exists (select 1 from public.evaluation_subsystems)
);

select setval(
  pg_get_serial_sequence('public.evaluation_type', 'evaluation_id'),
  coalesce((select max(evaluation_id) from public.evaluation_type), 1),
  exists (select 1 from public.evaluation_type)
);

select setval(
  pg_get_serial_sequence('public.eval_system_grades', 'grade_id'),
  coalesce((select max(grade_id) from public.eval_system_grades), 1),
  exists (select 1 from public.eval_system_grades)
);

select setval(
  pg_get_serial_sequence('public.cycles', 'cycle_id'),
  greatest(
    coalesce((select max(cycle_id) from public.cycles), 1),
    21
  ),
  true
);

CREATE OR REPLACE FUNCTION "public"."get_evaluation_subsystems"() RETURNS TABLE("subsystem_id" integer, "subsystem_cod" character varying, "practices_quantity" integer)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select
    es.subsystem_id,
    es.subsystem_cod,
    es.practices_quantity
  from public.evaluation_subsystems as es
  order by es.practices_quantity asc;
$$;

CREATE OR REPLACE FUNCTION "public"."get_evaluation_systems"() RETURNS TABLE("system_id" integer, "system_cod" character, "system_description" "text", "requires_subsystem" boolean)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select
    es.system_id,
    es.system_cod,
    es.system_description,
    es.requires_subsystem
  from public.evaluation_systems as es
  order by es.system_cod;
$$;

CREATE OR REPLACE FUNCTION "public"."get_variable_evaluations_by_system"("p_system_id" integer) RETURNS TABLE("evaluation_id" integer, "evaluation_name" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select distinct
    et.evaluation_id,
    et.evaluation_name
  from public.system_grades_consider as sgc
  join public.grade_evaluation_type as get1
    on get1.grade_id = sgc.grade_id
  join public.evaluation_type as et
    on et.evaluation_id = get1.evaluation_id
  where sgc.system_id = p_system_id
    and upper(coalesce(et.evaluation_category, '')) in (
      'PRACTICA',
      'LABORATORIO',
      'TRABAJO'
    )
  order by et.evaluation_name;
$$;


alter table public.evaluation_systems enable row level security;
alter table public.evaluation_subsystems enable row level security;
alter table public.evaluation_type enable row level security;
alter table public.eval_system_grades enable row level security;
alter table public.grade_evaluation_type enable row level security;
alter table public.system_grades_consider enable row level security;
alter table public.cycles enable row level security;

drop policy if exists "Allow read cycles" on public.cycles;
drop policy if exists "public read evaluation systems" on public.evaluation_systems;
drop policy if exists "public read evaluation types" on public.evaluation_type;
drop policy if exists "public read evaluation_subsystems" on public.evaluation_subsystems;
drop policy if exists "public read eval_system_grades" on public.eval_system_grades;
drop policy if exists "Allow read for all" on public.system_grades_consider;

create policy "public read cycles"
on public.cycles for select to anon, authenticated
using (true);

create policy "public read evaluation systems"
on public.evaluation_systems for select to anon, authenticated
using (true);

create policy "public read evaluation types"
on public.evaluation_type for select to anon, authenticated
using (true);

revoke all privileges on table
  public.evaluation_systems,
  public.evaluation_subsystems,
  public.evaluation_type,
  public.eval_system_grades,
  public.grade_evaluation_type,
  public.system_grades_consider,
  public.cycles
from public, anon, authenticated;

revoke all privileges on sequence
  public.evaluation_systems_system_id_seq,
  public.evaluation_subsystems_subsystem_id_seq,
  public.evaluation_type_evaluation_id_seq,
  public.eval_system_grades_grade_id_seq,
  public.cycles_cycle_id_seq
from public, anon, authenticated;

grant all privileges on table
  public.evaluation_systems,
  public.evaluation_subsystems,
  public.evaluation_type,
  public.eval_system_grades,
  public.grade_evaluation_type,
  public.system_grades_consider,
  public.cycles
  to service_role;

grant all privileges on sequence
  public.evaluation_systems_system_id_seq,
  public.evaluation_subsystems_subsystem_id_seq,
  public.evaluation_type_evaluation_id_seq,
  public.eval_system_grades_grade_id_seq,
  public.cycles_cycle_id_seq
  to service_role;

grant select on public.cycles to anon, authenticated;
grant select on public.evaluation_systems to anon, authenticated;
grant select on public.evaluation_type to anon, authenticated;

grant execute on function public.get_evaluation_subsystems()
  to anon, authenticated;
grant execute on function public.get_evaluation_systems()
  to anon, authenticated;
grant execute on function public.get_variable_evaluations_by_system(integer)
  to anon, authenticated;

commit;
