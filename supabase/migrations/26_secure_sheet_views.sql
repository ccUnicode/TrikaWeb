-- Migración 26
-- Asegurar visualizaciones y descargas de planchas
-- Retira acceso directo y mantiene view_count mediante trigger backend.
-- Diseñada para ejecutarse sobre el schema original entregado al equipo.

begin;

create or replace function public.refresh_view_count()
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
  set view_count = (
    select count(*)
    from public.sheet_views as sv
    where sv.sheet_id = s.id
  )
  where s.id = any(v_sheet_ids);

  return null;
end;
$$;


drop trigger if exists t_sheet_views_stats on public.sheet_views;
create trigger t_sheet_views_stats
after insert or delete or update of sheet_id
on public.sheet_views
for each row execute function public.refresh_view_count();

update public.sheets as s
set view_count = (
  select count(*)
  from public.sheet_views as sv
  where sv.sheet_id = s.id
);

alter table public.sheet_views enable row level security;

drop policy if exists "public read sheet_views" on public.sheet_views;

revoke all privileges on table public.sheet_views
  from public, anon, authenticated;
revoke all privileges on sequence public.sheet_views_id_seq
  from public, anon, authenticated;

grant all privileges on table public.sheet_views to service_role;
grant all privileges on sequence public.sheet_views_id_seq to service_role;

revoke execute on function public.refresh_view_count()
  from public, anon, authenticated;

commit;
