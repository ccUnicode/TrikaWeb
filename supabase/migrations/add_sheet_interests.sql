-- Migración: agregar el seguimiento de interés en las planchas
-- Agrega el contador desnormalizado a sheets y crea sheet_interests.
-- Es seguro ejecutarla sobre una base de datos existente.

begin;

-- Contador desnormalizado en sheets.
alter table public.sheets
  add column if not exists interest_count bigint;

update public.sheets
set interest_count = 0
where interest_count is null;

alter table public.sheets
  alter column interest_count set default 0,
  alter column interest_count set not null;

create table if not exists public.sheet_interests (
  id bigserial primary key,
  sheet_id bigint not null references public.sheets(id) on delete cascade,
  device_id uuid not null,
  ip_hash text not null,
  created_at timestamptz not null default now(),
  constraint sheet_interests_sheet_id_device_id_key
    unique (sheet_id, device_id)
);

create index if not exists idx_sheet_interests_sheet_id
  on public.sheet_interests (sheet_id);

-- Eliminar primero los triggers que puedan depender de funciones antiguas.
drop trigger if exists t_sheet_interests_stats on public.sheet_interests;
drop trigger if exists trg_sheet_interest_count on public.sheet_interests;

-- Eliminar implementaciones antiguas o duplicadas.
drop function if exists public.toggle_sheet_interest(bigint, text, text);
drop function if exists public.update_sheet_interest_count();

create or replace function public.refresh_interest_count()
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
  set interest_count = (
    select count(*)
    from public.sheet_interests as si
    where si.sheet_id = s.id
  )
  where s.id = any(v_sheet_ids);

  return null;
end;
$$;

create or replace function public.reset_sheet_interest(p_sheet_id bigint)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform 1
  from public.sheets
  where id = p_sheet_id
  for update;

  if not found then
    raise exception 'Plancha no encontrada';
  end if;

  delete from public.sheet_interests
  where sheet_id = p_sheet_id;

  update public.sheets
  set interest_count = 0
  where id = p_sheet_id;
end;
$$;

create or replace function public.toggle_sheet_interest(
  p_sheet_id bigint,
  p_device_id uuid,
  p_ip_hash text
)
returns json
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_deleted_id bigint;
  v_is_interested boolean;
  v_new_count bigint;
begin
  if p_device_id is null then
    raise exception 'device_id es requerido';
  end if;

  if nullif(btrim(p_ip_hash), '') is null then
    raise exception 'ip_hash es requerido';
  end if;

  -- Serializa los toggles de una misma plancha y evita carreras.
  perform 1
  from public.sheets
  where id = p_sheet_id
  for update;

  if not found then
    raise exception 'Plancha no encontrada';
  end if;

  delete from public.sheet_interests
  where sheet_id = p_sheet_id
    and device_id = p_device_id
  returning id into v_deleted_id;

  if v_deleted_id is null then
    insert into public.sheet_interests (
      sheet_id,
      device_id,
      ip_hash
    )
    values (
      p_sheet_id,
      p_device_id,
      p_ip_hash
    );

    v_is_interested := true;
  else
    v_is_interested := false;
  end if;

  select interest_count
  into v_new_count
  from public.sheets
  where id = p_sheet_id;

  return json_build_object(
    'interested', v_is_interested,
    'interest_count', coalesce(v_new_count, 0)
  );
end;
$$;


create trigger t_sheet_interests_stats
after insert or delete or update of sheet_id
on public.sheet_interests
for each row execute function public.refresh_interest_count();

-- Sincronizar registros existentes.
update public.sheets as s
set interest_count = (
  select count(*)
  from public.sheet_interests as si
  where si.sheet_id = s.id
);

alter table public.sheet_interests
  enable row level security;

-- No se crean políticas: la tabla únicamente será utilizada
-- desde el backend mediante supabaseAdmin/service_role.
drop policy if exists "allow delete sheet_interests"
  on public.sheet_interests;

drop policy if exists "allow insert sheet_interests"
  on public.sheet_interests;

-- Bloquear todo acceso directo desde roles cliente.
revoke all privileges
on table public.sheet_interests
from public, anon, authenticated;

revoke all privileges
on sequence public.sheet_interests_id_seq
from public, anon, authenticated;

-- Autorizar únicamente las operaciones necesarias del backend.
grant select, insert, update, delete
on table public.sheet_interests
to service_role;

grant usage
on sequence public.sheet_interests_id_seq
to service_role;

-- Las operaciones deben invocarse exclusivamente desde el backend.
grant execute
on function public.toggle_sheet_interest(bigint, uuid, text)
to service_role;

grant execute
on function public.reset_sheet_interest(bigint)
to service_role;

-- Bloquear ejecución directa desde roles cliente.
revoke execute
on function public.refresh_interest_count()
from public, anon, authenticated;

revoke execute
on function public.toggle_sheet_interest(bigint, uuid, text)
from public, anon, authenticated;

revoke execute
on function public.reset_sheet_interest(bigint)
from public, anon, authenticated;

commit;
