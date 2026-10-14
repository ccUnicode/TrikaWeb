-- Migración 24
-- Endurecimiento de acceso a la base de datos
-- Fecha: 2026-07-24
--
-- Objetivos:
--   1. Eliminar políticas duplicadas o temporales.
--   2. Evitar que un estudiante autenticado pueda administrar mallas.
--   3. Evitar escalamiento de privilegios mediante profiles.role.
--   4. Restringir columnas sensibles y tablas de telemetría.
--   5. Limitar permisos de tablas, secuencias y funciones.
--
-- IMPORTANTE:
--   - Ejecute primero en un entorno de prueba.
--   - sheet_interests permanece reservado para el backend/service_role.

begin;

-- --------------------------------------------------------------------------
-- 1. Función auxiliar para comprobar el rol administrativo
-- --------------------------------------------------------------------------
create or replace function public.is_current_user_admin()
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select exists (
    select 1
    from public.profiles as p
    where p.id = auth.uid()
      and p.role = 'admin'::public.user_role
  );
$function$;

revoke execute on function public.is_current_user_admin() from public;
grant execute on function public.is_current_user_admin() to authenticated, service_role;

-- --------------------------------------------------------------------------
-- 2. Funciones públicas de lectura: search_path fijo y referencias calificadas
-- --------------------------------------------------------------------------
create or replace function public.get_average_stars(p_sheet_id bigint)
returns numeric
language sql
stable
set search_path to ''
as $function$
  select coalesce(avg(sf.stars), 0)
  from public.sheet_feedback as sf
  where sf.sheet_id = p_sheet_id
    and sf.is_hidden = false;
$function$;

create or replace function public.get_evaluation_subsystems()
returns table (
  subsystem_id integer,
  subsystem_cod varchar,
  practices_quantity integer
)
language sql
stable
security definer
set search_path to ''
as $function$
  select
    es.subsystem_id,
    es.subsystem_cod,
    es.practices_quantity
  from public.evaluation_subsystems as es
  order by es.practices_quantity asc;
$function$;

create or replace function public.get_evaluation_systems()
returns table (
  system_id integer,
  system_cod character,
  system_description text,
  requires_subsystem boolean
)
language sql
stable
security definer
set search_path to ''
as $function$
  select
    es.system_id,
    es.system_cod,
    es.system_description,
    es.requires_subsystem
  from public.evaluation_systems as es
  order by es.system_cod;
$function$;

create or replace function public.get_variable_evaluations_by_system(
  p_system_id integer
)
returns table (
  evaluation_id integer,
  evaluation_name text
)
language sql
stable
security definer
set search_path to ''
as $function$
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
$function$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  insert into public.profiles (
    id,
    email,
    full_name,
    role
  )
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    'student'::public.user_role
  )
  on conflict (id) do update
    set email = excluded.email;

  return new;
end;
$function$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path to ''
as $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

-- RPC administrativas: solo backend con service_role.
revoke execute on function public.create_course_with_evaluations(
  text,
  text,
  text,
  integer,
  integer,
  integer,
  integer[]
) from public, anon, authenticated;

grant execute on function public.create_course_with_evaluations(
  text,
  text,
  text,
  integer,
  integer,
  integer,
  integer[]
) to service_role;

revoke execute on function public.update_course_with_evaluations(
  integer,
  text,
  text,
  text,
  integer,
  integer,
  integer,
  integer[]
) from public, anon, authenticated;

grant execute on function public.update_course_with_evaluations(
  integer,
  text,
  text,
  text,
  integer,
  integer,
  integer,
  integer[]
) to service_role;

-- Funciones de lectura permitidas para el cliente.
revoke execute on function public.get_average_stars(bigint)
  from public;
grant execute on function public.get_average_stars(bigint)
  to anon, authenticated, service_role;

revoke execute on function public.get_evaluation_subsystems()
  from public;
grant execute on function public.get_evaluation_subsystems()
  to anon, authenticated, service_role;

revoke execute on function public.get_evaluation_systems()
  from public;
grant execute on function public.get_evaluation_systems()
  to anon, authenticated, service_role;

revoke execute on function public.get_variable_evaluations_by_system(integer)
  from public;
grant execute on function public.get_variable_evaluations_by_system(integer)
  to anon, authenticated, service_role;

-- Funciones exclusivas de triggers.
revoke execute on function public.handle_new_user()
  from public, anon, authenticated, service_role;
revoke execute on function public.set_updated_at()
  from public, anon, authenticated, service_role;
revoke execute on function public.refresh_sheet_stats()
  from public, anon, authenticated, service_role;
revoke execute on function public.refresh_teacher_stats()
  from public, anon, authenticated, service_role;
revoke execute on function public.refresh_view_count()
  from public, anon, authenticated, service_role;

-- --------------------------------------------------------------------------
-- 3. Eliminar políticas duplicadas o temporales
-- --------------------------------------------------------------------------
drop policy if exists
  "Permitir lectura publica de sistemas de evaluacion"
  on public.evaluation_systems;

drop policy if exists
  "Los usuarios pueden leer su propio perfil"
  on public.profiles;

-- NOTA: Las políticas sobre study_plans y plan_courses no se eliminan aquí
-- porque esas tablas son creadas por migraciones posteriores (32 y 36).
-- El endurecimiento de esas tablas se aplica en la migración 37.

-- --------------------------------------------------------------------------
-- 4. Perfiles: impedir autoasignación del rol admin
-- --------------------------------------------------------------------------
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;

create policy "profiles_select_own"
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = id);

create policy "profiles_update_own"
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

revoke all privileges on table public.profiles from anon, authenticated;
grant select on table public.profiles to authenticated;
grant update (
  email,
  full_name,
  username,
  avatar_url
) on table public.profiles to authenticated;

-- --------------------------------------------------------------------------
-- 5. Ocultar filas administrativas en consultas públicas
--    (solo tablas que existen antes de esta migración)
-- --------------------------------------------------------------------------
drop policy if exists "public read courses" on public.courses;
create policy "public read visible courses"
  on public.courses
  for select
  to anon, authenticated
  using (coalesce(is_hidden, false) = false);

drop policy if exists "public read sheets" on public.sheets;
create policy "public read visible sheets"
  on public.sheets
  for select
  to anon, authenticated
  using (
    is_hidden = false
    and exists (
      select 1
      from public.courses as c
      where c.id = sheets.course_id
        and coalesce(c.is_hidden, false) = false
    )
  );

drop policy if exists
  "public read courses_teachers"
  on public.courses_teachers;
create policy "public read visible courses_teachers"
  on public.courses_teachers
  for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.courses as c
      where c.id = courses_teachers.course_id
        and coalesce(c.is_hidden, false) = false
    )
    and exists (
      select 1
      from public.teachers as t
      where t.id = courses_teachers.teacher_id
        and t.is_hidden = false
    )
  );

-- Las tablas anteriores no deben aceptar escrituras del cliente fuera de RLS.
revoke all privileges on table public.sheets from anon, authenticated;
grant select on table public.sheets to anon, authenticated;

-- --------------------------------------------------------------------------
-- 6. Comentarios públicos: filtrar moderación y ocultar columnas sensibles
--    (solo teacher_ratings, que existe antes de esta migración)
-- --------------------------------------------------------------------------
drop policy if exists
  "public read teacher_ratings"
  on public.teacher_ratings;
create policy "public read approved teacher ratings"
  on public.teacher_ratings
  for select
  to anon, authenticated
  using (
    is_hidden = false
    and coalesce(needs_review, true) = false
  );

revoke all privileges on table public.teacher_ratings from anon, authenticated;
grant select (
  id,
  teacher_id,
  overall,
  difficulty,
  didactic,
  resources,
  responsability,
  grading,
  comment,
  is_anonymous,
  user_name,
  created_at
) on table public.teacher_ratings to anon, authenticated;

-- NOTA: Las políticas y permisos sobre sheet_feedback se aplican en la
-- migración 37, después de que la tabla es creada por la migración 36.

-- --------------------------------------------------------------------------
-- 7. Telemetría y rate limiting: acceso exclusivo desde backend
-- --------------------------------------------------------------------------
drop policy if exists "public read sheet_ratings" on public.sheet_ratings;
drop policy if exists "public read sheet_views" on public.sheet_views;

revoke all privileges on table public.sheet_ratings from anon, authenticated;
revoke all privileges on table public.sheet_views from anon, authenticated;
revoke all privileges on table public.write_limits from anon, authenticated;

-- sheet_interests se modifica exclusivamente mediante endpoints/RPC del
-- backend. No se concede acceso directo a roles cliente.
drop policy if exists
  "public read sheet_interests"
  on public.sheet_interests;

drop policy if exists
  "allow insert sheet_interests"
  on public.sheet_interests;

drop policy if exists
  "allow delete sheet_interests"
  on public.sheet_interests;

revoke all privileges
on table public.sheet_interests
from public, anon, authenticated;

-- El backend usa service_role; se garantiza acceso completo a objetos de datos.
grant all privileges on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;

alter default privileges in schema public
  grant all privileges on tables to service_role;
alter default privileges in schema public
  grant usage, select on sequences to service_role;

-- --------------------------------------------------------------------------
-- 8. Secuencias: solo las necesarias para inserciones públicas vigentes
--    (contributions_id_seq existe antes de esta migración;
--     sheet_feedback_id_seq se concede en la migración 37)
-- --------------------------------------------------------------------------
revoke all privileges on all sequences in schema public
  from anon, authenticated;

grant usage on sequence public.contributions_id_seq
  to authenticated;

commit;
