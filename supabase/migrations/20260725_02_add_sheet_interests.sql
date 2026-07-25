-- Migración: agregar el seguimiento de interés en las planchas
-- Agrega el contador desnormalizado a sheets y crea sheet_interests.
-- Es seguro ejecutarla sobre una base de datos existente.

begin;

-- 1. Contador almacenado en cada plancha
alter table public.sheets
  add column if not exists interest_count bigint;

update public.sheets
set interest_count = 0
where interest_count is null;

alter table public.sheets
  alter column interest_count set default 0,
  alter column interest_count set not null;

-- 2. Registros de interés
create table if not exists public.sheet_interests (
  id bigserial primary key,
  sheet_id bigint not null,
  device_id uuid not null,
  ip_hash text not null,
  created_at timestamptz not null default now()
);

-- 3. Relación con tabla sheets
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.sheet_interests'::regclass
      and conname = 'sheet_interests_sheet_id_fkey'
  ) then
    alter table public.sheet_interests
      add constraint sheet_interests_sheet_id_fkey
      foreign key (sheet_id)
      references public.sheets(id)
      on delete cascade;
  end if;
end
$$;

-- 4. Evitar que el mismo dispositivo registre su interés dos veces
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.sheet_interests'::regclass
      and conname = 'sheet_interests_sheet_id_device_id_key'
  ) then
    alter table public.sheet_interests
      add constraint sheet_interests_sheet_id_device_id_key
      unique (sheet_id, device_id);
  end if;
end
$$;

-- 5. Mantener interest_count sincronizado automáticamente
create or replace function public.refresh_sheet_interest_count()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op in ('DELETE', 'UPDATE') then
    update public.sheets s
    set interest_count = (
      select count(*)
      from public.sheet_interests si
      where si.sheet_id = old.sheet_id
    )
    where s.id = old.sheet_id;
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    update public.sheets s
    set interest_count = (
      select count(*)
      from public.sheet_interests si
      where si.sheet_id = new.sheet_id
    )
    where s.id = new.sheet_id;
  end if;

  return null;
end;
$$;

drop trigger if exists t_sheet_interests_count
on public.sheet_interests;

create trigger t_sheet_interests_count
after insert or delete or update of sheet_id
on public.sheet_interests
for each row
execute function public.refresh_sheet_interest_count();

-- 6. Completar el contador para los registros existentes
update public.sheets s
set interest_count = (
  select count(*)
  from public.sheet_interests si
  where si.sheet_id = s.id
);

-- Las funciones de los triggers no deben poder ser ejecutadas directamente por los roles del cliente
revoke execute
on function public.refresh_sheet_interest_count()
from public, anon, authenticated;

commit;
