-- Migración 25
-- Asegurar calificaciones de dificultad de planchas
-- Retira acceso directo, mantiene métricas por trigger y evita exponer IP o dispositivo.
-- Diseñada para ejecutarse sobre el schema original entregado al equipo.

begin;

create or replace function public.refresh_sheet_stats()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
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
        select avg(sr.score)::numeric(3,2)
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
$$;


drop trigger if exists t_sheet_ratings_stats on public.sheet_ratings;
create trigger t_sheet_ratings_stats
after insert or delete or update of sheet_id, score
on public.sheet_ratings
for each row execute function public.refresh_sheet_stats();

update public.sheets as s
set
  avg_difficulty = coalesce((
    select avg(sr.score)::numeric(3,2)
    from public.sheet_ratings as sr
    where sr.sheet_id = s.id
  ), 0),
  rating_count = (
    select count(*)
    from public.sheet_ratings as sr
    where sr.sheet_id = s.id
  );

alter table public.sheet_ratings enable row level security;

drop policy if exists "public read sheet_ratings" on public.sheet_ratings;

-- Las votaciones se realizan mediante endpoint backend.
revoke all privileges on table public.sheet_ratings
  from public, anon, authenticated;
revoke all privileges on sequence public.sheet_ratings_id_seq
  from public, anon, authenticated;

grant all privileges on table public.sheet_ratings to service_role;
grant all privileges on sequence public.sheet_ratings_id_seq to service_role;

revoke execute on function public.refresh_sheet_stats()
  from public, anon, authenticated;

commit;
