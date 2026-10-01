-- Migración 30
-- Cambiar la lógica de teacher_ratings a post-moderación
-- Las reseñas ahora serán visibles (y afectarán las estadísticas) tan pronto como
-- is_hidden = false, sin importar si needs_review está pendiente o no.

begin;

-- 1. Actualizar la función de trigger para no filtrar por needs_review
create or replace function public.refresh_teacher_stats()
returns trigger
language plpgsql
security invoker
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

  update public.teachers as teacher
  set
    avg_overall = coalesce(
      (
        select avg(rating.overall)::numeric(3, 2)
        from public.teacher_ratings as rating
        where rating.teacher_id = teacher.id
          and coalesce(rating.is_hidden, false) = false
      ),
      0
    ),
    rating_count = (
      select count(*)
      from public.teacher_ratings as rating
      where rating.teacher_id = teacher.id
        and coalesce(rating.is_hidden, false) = false
    )
  where teacher.id = any(v_teacher_ids);

  return null;
end;
$function$;

-- Las funciones de trigger no deben invocarse por RPC.
revoke execute on function public.refresh_teacher_stats()
  from public, anon, authenticated, service_role;


-- 2. Actualizar las estadísticas actuales
update public.teachers as teacher
set
  avg_overall = coalesce(
    (
      select avg(rating.overall)::numeric(3, 2)
      from public.teacher_ratings as rating
      where rating.teacher_id = teacher.id
        and coalesce(rating.is_hidden, false) = false
    ),
    0
  ),
  rating_count = (
    select count(*)
    from public.teacher_ratings as rating
    where rating.teacher_id = teacher.id
      and coalesce(rating.is_hidden, false) = false
  );


-- 3. Actualizar la vista pública
drop view if exists public.public_teacher_ratings;

create view public.public_teacher_ratings as
select
  rating.id,
  rating.teacher_id,
  rating.overall,
  rating.difficulty,
  rating.didactic,
  rating.resources,
  rating.responsability,
  rating.grading,
  rating.comment,
  rating.created_at,
  rating.is_hidden,
  rating.is_anonymous,
  case
    when rating.is_anonymous then null
    else rating.user_id
  end as user_id,
  case
    when rating.is_anonymous then 'Anónimo'
    else rating.user_name
  end as user_name,
  case
    when rating.is_anonymous then null
    else student.avatar_url
  end as avatar_url
from public.teacher_ratings as rating
left join public.student_details as student
  on student.user_id = rating.user_id
where rating.is_hidden = false;

revoke all privileges on table public.public_teacher_ratings from public, anon, authenticated;
grant select on table public.public_teacher_ratings to anon, authenticated;


-- 4. Actualizar la política RLS
drop policy if exists "public read approved teacher ratings" on public.teacher_ratings;

create policy "public read approved teacher ratings"
  on public.teacher_ratings
  for select
  to anon, authenticated
  using (
    is_hidden = false
  );

commit;
