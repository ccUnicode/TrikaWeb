-- Migración 22
-- Agregar moderación y anonimato a valoraciones de docentes
-- Amplía las valoraciones, recalcula estadísticas aprobadas y protege datos personales.
-- Diseñada para ejecutarse sobre el schema original entregado al equipo.

begin;


alter table public.teacher_ratings
  alter column overall type numeric(3,2)
  using overall::numeric(3,2);

alter table public.teacher_ratings
  add column if not exists needs_review boolean;

-- Las valoraciones previas se consideran revisadas; las nuevas quedan pendientes.
update public.teacher_ratings
set needs_review = false
where needs_review is null;

alter table public.teacher_ratings
  alter column needs_review set default true;

alter table public.teacher_ratings
  add column if not exists is_anonymous boolean default true,
  add column if not exists user_name text,
  add column if not exists user_email text,
  add column if not exists user_id text;

update public.teacher_ratings
set is_anonymous = true
where is_anonymous is null;

alter table public.teacher_ratings
  alter column is_anonymous set default true,
  alter column is_anonymous set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.teacher_ratings'::regclass
      and conname = 'teacher_ratings_user_id_fkey'
  ) then
    alter table public.teacher_ratings
      add constraint teacher_ratings_user_id_fkey
      foreign key (user_id)
      references public.student_details(user_id)
      on delete set null;
  end if;
end
$$;

create index if not exists idx_teacher_ratings_needs_review
  on public.teacher_ratings (needs_review)
  where needs_review = true;

create or replace function public.refresh_teacher_stats()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
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
        select avg(tr.overall)::numeric(3,2)
        from public.teacher_ratings as tr
        where tr.teacher_id = t.id
          and coalesce(tr.is_hidden, false) = false
          and coalesce(tr.needs_review, true) = false
      ),
      0
    ),
    rating_count = (
      select count(*)
      from public.teacher_ratings as tr
      where tr.teacher_id = t.id
        and coalesce(tr.is_hidden, false) = false
        and coalesce(tr.needs_review, true) = false
    )
  where t.id = any(v_teacher_ids);

  return null;
end;
$$;


drop trigger if exists set_teacher_ratings_updated_at on public.teacher_ratings;
create trigger set_teacher_ratings_updated_at
before update on public.teacher_ratings
for each row execute function public.set_updated_at();

drop trigger if exists t_teacher_ratings_stats on public.teacher_ratings;
create trigger t_teacher_ratings_stats
after insert or delete or update of teacher_id, overall, is_hidden, needs_review
on public.teacher_ratings
for each row execute function public.refresh_teacher_stats();

-- Reconstruir estadísticas solo con valoraciones públicas aprobadas.
update public.teachers as t
set
  avg_overall = coalesce((
    select avg(tr.overall)::numeric(3,2)
    from public.teacher_ratings as tr
    where tr.teacher_id = t.id
      and tr.is_hidden = false
      and coalesce(tr.needs_review, true) = false
  ), 0),
  rating_count = (
    select count(*)
    from public.teacher_ratings as tr
    where tr.teacher_id = t.id
      and tr.is_hidden = false
      and coalesce(tr.needs_review, true) = false
  );


-- La vista pública creada en la migración 14 debe excluir también
-- las reseñas que todavía requieren moderación.
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
where rating.is_hidden = false
  and coalesce(rating.needs_review, true) = false;

revoke all privileges
on table public.public_teacher_ratings
from public, anon, authenticated;

grant select
on table public.public_teacher_ratings
to anon, authenticated;

alter table public.teacher_ratings enable row level security;

drop policy if exists "public read teacher_ratings" on public.teacher_ratings;
drop policy if exists "public read approved teacher ratings" on public.teacher_ratings;
drop policy if exists ratings_insert_all on public.teacher_ratings;
drop policy if exists ratings_select_all on public.teacher_ratings;

create policy "public read approved teacher ratings"
on public.teacher_ratings
for select to anon, authenticated
using (
  is_hidden = false
  and coalesce(needs_review, true) = false
);

revoke all privileges on table public.teacher_ratings
  from public, anon, authenticated;
revoke all privileges on sequence public.teacher_ratings_id_seq
  from public, anon, authenticated;

grant all privileges on table public.teacher_ratings to service_role;
grant all privileges on sequence public.teacher_ratings_id_seq to service_role;

-- Se exponen únicamente columnas públicas; nunca IP, dispositivo o correo.
grant select (
  id, teacher_id, overall, difficulty, didactic, resources,
  responsability, grading, comment, created_at, is_anonymous, user_name
) on public.teacher_ratings to anon, authenticated;

revoke execute on function public.refresh_teacher_stats()
  from public, anon, authenticated;

commit;
