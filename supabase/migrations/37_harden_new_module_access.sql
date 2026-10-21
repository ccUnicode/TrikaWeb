-- Migración 37
-- Endurecimiento de acceso para módulos de feedback y mallas curriculares
-- Fecha: 2026-10-13
--
-- Esta migración debe ejecutarse DESPUÉS de:
--   - 32_create_mallas_tables.sql  (crea study_plans, plan_courses, course_prerequisites)
--   - 36_add_sheet_feedback.sql    (crea sheet_feedback y sheet_feedback_id_seq)
--   - 29_add_user_to_sheet_feedback.sql (añade columnas de usuario a sheet_feedback)
--
-- Contiene el endurecimiento que no pudo incluirse en la migración 24 porque
-- las tablas objetivo no existían aún en ese punto de la secuencia.

begin;

-- --------------------------------------------------------------------------
-- 1. Mallas: lectura pública y administración solo para profiles.role = admin
-- --------------------------------------------------------------------------
drop policy if exists "Permitir todo a usuarios en study_plans"
  on public.study_plans;
drop policy if exists "Permitir anon temporalmente"
  on public.plan_courses;
drop policy if exists
  "Permitir todo a usuarios logueados en plan_courses"
  on public.plan_courses;
drop policy if exists
  "Permitir todo a usuarios logueados en course_prerequisites"
  on public.course_prerequisites;
drop policy if exists
  "Permitir todo a usuarios logueados"
  on public.study_plans;
drop policy if exists "Public read study_plans" on public.study_plans;
drop policy if exists "Public read plan_courses" on public.plan_courses;
drop policy if exists "Public read course_prerequisites" on public.course_prerequisites;
drop policy if exists "Admin write study_plans" on public.study_plans;
drop policy if exists "Admin write plan_courses" on public.plan_courses;
drop policy if exists "Admin write course_prerequisites" on public.course_prerequisites;

-- Políticas de lectura pública (solo planes publicados)
drop policy if exists "Planes de estudio visibles para todos" on public.study_plans;
create policy "public read published study_plans"
  on public.study_plans
  for select
  to anon, authenticated
  using (coalesce(is_published, false) = true);

drop policy if exists "Cursos de plan visibles para todos" on public.plan_courses;
create policy "public read published plan_courses"
  on public.plan_courses
  for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.study_plans as sp
      where sp.id = plan_courses.plan_id
        and coalesce(sp.is_published, false) = true
    )
  );

drop policy if exists "Prerequisitos visibles para todos" on public.course_prerequisites;
create policy "public read published course_prerequisites"
  on public.course_prerequisites
  for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.study_plans as sp
      where sp.id = course_prerequisites.plan_id
        and coalesce(sp.is_published, false) = true
    )
  );

-- Políticas de administración (solo admins autenticados)
create policy "admin_manage_study_plans"
  on public.study_plans
  for all
  to authenticated
  using (public.is_current_user_admin())
  with check (public.is_current_user_admin());

create policy "admin_manage_plan_courses"
  on public.plan_courses
  for all
  to authenticated
  using (public.is_current_user_admin())
  with check (public.is_current_user_admin());

create policy "admin_manage_course_prerequisites"
  on public.course_prerequisites
  for all
  to authenticated
  using (public.is_current_user_admin())
  with check (public.is_current_user_admin());

-- Permisos de tabla: clientes solo pueden leer; escritura reservada a service_role
revoke all privileges on table public.study_plans from anon, authenticated;
grant select on table public.study_plans to anon, authenticated;
grant insert, update, delete on table public.study_plans to authenticated;

revoke all privileges on table public.plan_courses from anon, authenticated;
grant select on table public.plan_courses to anon, authenticated;
grant insert, update, delete on table public.plan_courses to authenticated;

revoke all privileges on table public.course_prerequisites from anon, authenticated;
grant select on table public.course_prerequisites to anon, authenticated;
grant insert, update, delete on table public.course_prerequisites to authenticated;

-- --------------------------------------------------------------------------
-- 2. Feedback de planchas: filtrar moderación y ocultar columnas sensibles
-- --------------------------------------------------------------------------
drop policy if exists "Public can read visible sheet feedback" on public.sheet_feedback;
drop policy if exists "Public can insert sheet feedback" on public.sheet_feedback;

create policy "public read approved sheet feedback"
  on public.sheet_feedback
  for select
  to anon, authenticated
  using (
    coalesce(is_hidden, false) = false
    and coalesce(needs_review, true) = false
  );

create policy "public insert pending sheet feedback"
  on public.sheet_feedback
  for insert
  to anon, authenticated
  with check (
    coalesce(is_hidden, false) = false
    and coalesce(needs_review, true) = true
  );

-- Columnas visibles para el cliente (excluye device_id, ip_hash, user_email)
revoke all privileges on table public.sheet_feedback from anon, authenticated;
grant select (
  id,
  sheet_id,
  content,
  created_at,
  user_id,
  user_name,
  user_avatar,
  is_anonymous,
  is_hidden,
  needs_review
) on table public.sheet_feedback to anon, authenticated;
grant insert (
  sheet_id,
  content,
  device_id,
  user_id,
  user_name,
  user_email,
  user_avatar,
  is_anonymous
) on table public.sheet_feedback to anon, authenticated;

-- --------------------------------------------------------------------------
-- 3. Reacciones de feedback: RLS básico
-- --------------------------------------------------------------------------
drop policy if exists "public read sheet_feedback_reactions"
  on public.sheet_feedback_reactions;
create policy "public read sheet_feedback_reactions"
  on public.sheet_feedback_reactions
  for select
  to anon, authenticated
  using (true);

create policy "authenticated insert sheet_feedback_reactions"
  on public.sheet_feedback_reactions
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "authenticated delete own sheet_feedback_reactions"
  on public.sheet_feedback_reactions
  for delete
  to authenticated
  using (auth.uid() = user_id);

revoke all privileges on table public.sheet_feedback_reactions
  from anon, authenticated;
grant select on table public.sheet_feedback_reactions to anon, authenticated;
grant insert, delete on table public.sheet_feedback_reactions to authenticated;

-- --------------------------------------------------------------------------
-- 4. Secuencia sheet_feedback_id_seq: acceso necesario para inserciones
-- --------------------------------------------------------------------------
grant usage on sequence public.sheet_feedback_id_seq
  to anon, authenticated;

-- --------------------------------------------------------------------------
-- 5. get_average_stars(): eliminar función obsoleta
-- --------------------------------------------------------------------------
-- La migración 36 crea get_average_stars() sobre sheet_feedback.stars y la
-- migración 29 elimina esa columna, por lo que la función ya no puede
-- ejecutarse. La aplicación no la utiliza; se elimina en lugar de endurecerla.
drop function if exists public.get_average_stars(bigint);

commit;
