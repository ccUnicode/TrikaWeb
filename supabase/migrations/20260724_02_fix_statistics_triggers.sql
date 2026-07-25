-- ============================================================================
-- TrikaWeb - Sincronización de estadísticas y updated_at
-- Fecha: 2026-07-24
--
-- Esta migración es idempotente y mantiene el comportamiento actual:
-- view_count contabiliza tanto eventos 'view' como 'download'.
-- Para contar solo vistas, agregue: AND sv.type = 'view'.
-- ============================================================================

begin;

-- --------------------------------------------------------------------------
-- 1. Funciones de estadísticas
-- --------------------------------------------------------------------------
create or replace function public.refresh_sheet_stats()
returns trigger
language plpgsql
set search_path to ''
as $function$
declare
  v_sheet_ids bigint[];
begin
  case tg_op
    when 'INSERT' then
      v_sheet_ids := array[new.sheet_id];
    when 'DELETE' then
      v_sheet_ids := array[old.sheet_id];
    when 'UPDATE' then
      v_sheet_ids := array[old.sheet_id, new.sheet_id];
    else
      raise exception 'Operación de trigger no soportada: %', tg_op;
  end case;

  update public.sheets as s
  set
    avg_difficulty = coalesce(
      (
        select avg(sr.score)::numeric(3, 2)
        from public.sheet_ratings as sr
        where sr.sheet_id = s.id
      ),
      0
    ),
    rating_count = (
      select count(*)
      from public.sheet_ratings as sr
      where sr.sheet_id = s.id
    )
  where s.id = any(v_sheet_ids);

  return null;
end;
$function$;

create or replace function public.refresh_teacher_stats()
returns trigger
language plpgsql
set search_path to ''
as $function$
declare
  v_teacher_ids bigint[];
begin
  case tg_op
    when 'INSERT' then
      v_teacher_ids := array[new.teacher_id];
    when 'DELETE' then
      v_teacher_ids := array[old.teacher_id];
    when 'UPDATE' then
      v_teacher_ids := array[old.teacher_id, new.teacher_id];
    else
      raise exception 'Operación de trigger no soportada: %', tg_op;
  end case;

  update public.teachers as t
  set
    avg_overall = coalesce(
      (
        select avg(tr.overall)::numeric(3, 2)
        from public.teacher_ratings as tr
        where tr.teacher_id = t.id
      ),
      0
    ),
    rating_count = (
      select count(*)
      from public.teacher_ratings as tr
      where tr.teacher_id = t.id
    )
  where t.id = any(v_teacher_ids);

  return null;
end;
$function$;

create or replace function public.refresh_view_count()
returns trigger
language plpgsql
set search_path to ''
as $function$
declare
  v_sheet_ids bigint[];
begin
  case tg_op
    when 'INSERT' then
      v_sheet_ids := array[new.sheet_id];
    when 'DELETE' then
      v_sheet_ids := array[old.sheet_id];
    when 'UPDATE' then
      v_sheet_ids := array[old.sheet_id, new.sheet_id];
    else
      raise exception 'Operación de trigger no soportada: %', tg_op;
  end case;

  update public.sheets as s
  set view_count = (
    select count(*)
    from public.sheet_views as sv
    where sv.sheet_id = s.id
  )
  where s.id = any(v_sheet_ids);

  return null;
end;
$function$;

create or replace function public.refresh_interest_count()
returns trigger
language plpgsql
set search_path to ''
as $function$
declare
  v_sheet_ids bigint[];
begin
  case tg_op
    when 'INSERT' then
      v_sheet_ids := array[new.sheet_id];
    when 'DELETE' then
      v_sheet_ids := array[old.sheet_id];
    when 'UPDATE' then
      v_sheet_ids := array[old.sheet_id, new.sheet_id];
    else
      raise exception 'Operación de trigger no soportada: %', tg_op;
  end case;

  update public.sheets as s
  set interest_count = (
    select count(*)
    from public.sheet_interests as si
    where si.sheet_id = s.id
  )
  where s.id = any(v_sheet_ids);

  return null;
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

-- --------------------------------------------------------------------------
-- 2. Triggers
-- --------------------------------------------------------------------------
drop trigger if exists t_sheet_ratings_stats on public.sheet_ratings;
create trigger t_sheet_ratings_stats
  after insert or delete or update
  on public.sheet_ratings
  for each row
  execute function public.refresh_sheet_stats();

drop trigger if exists t_teacher_ratings_stats on public.teacher_ratings;
create trigger t_teacher_ratings_stats
  after insert or delete or update
  on public.teacher_ratings
  for each row
  execute function public.refresh_teacher_stats();

drop trigger if exists t_sheet_views_stats on public.sheet_views;
create trigger t_sheet_views_stats
  after insert or delete or update
  on public.sheet_views
  for each row
  execute function public.refresh_view_count();

drop trigger if exists t_sheet_interests_stats on public.sheet_interests;
create trigger t_sheet_interests_stats
  after insert or delete or update
  on public.sheet_interests
  for each row
  execute function public.refresh_interest_count();

drop trigger if exists set_contributions_updated_at on public.contributions;
create trigger set_contributions_updated_at
  before update
  on public.contributions
  for each row
  execute function public.set_updated_at();

drop trigger if exists set_sheet_feedback_updated_at on public.sheet_feedback;
create trigger set_sheet_feedback_updated_at
  before update
  on public.sheet_feedback
  for each row
  execute function public.set_updated_at();

drop trigger if exists set_teacher_ratings_updated_at on public.teacher_ratings;
create trigger set_teacher_ratings_updated_at
  before update
  on public.teacher_ratings
  for each row
  execute function public.set_updated_at();

-- El trigger de profiles ya existe; se recrea para mantener una definición única.
drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
  before update
  on public.profiles
  for each row
  execute function public.set_updated_at();

-- Las funciones de trigger no deben invocarse por RPC.
revoke execute on function public.refresh_sheet_stats()
  from public, anon, authenticated, service_role;
revoke execute on function public.refresh_teacher_stats()
  from public, anon, authenticated, service_role;
revoke execute on function public.refresh_view_count()
  from public, anon, authenticated, service_role;
revoke execute on function public.refresh_interest_count()
  from public, anon, authenticated, service_role;
revoke execute on function public.set_updated_at()
  from public, anon, authenticated, service_role;

-- --------------------------------------------------------------------------
-- 3. Recalcular valores existentes
-- --------------------------------------------------------------------------
update public.sheets as s
set
  avg_difficulty = coalesce(
    (
      select avg(sr.score)::numeric(3, 2)
      from public.sheet_ratings as sr
      where sr.sheet_id = s.id
    ),
    0
  ),
  rating_count = (
    select count(*)
    from public.sheet_ratings as sr
    where sr.sheet_id = s.id
  ),
  view_count = (
    select count(*)
    from public.sheet_views as sv
    where sv.sheet_id = s.id
  ),
  interest_count = (
    select count(*)
    from public.sheet_interests as si
    where si.sheet_id = s.id
  );

update public.teachers as t
set
  avg_overall = coalesce(
    (
      select avg(tr.overall)::numeric(3, 2)
      from public.teacher_ratings as tr
      where tr.teacher_id = t.id
    ),
    0
  ),
  rating_count = (
    select count(*)
    from public.teacher_ratings as tr
    where tr.teacher_id = t.id
  );

commit;
