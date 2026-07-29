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

-- Eliminar primero todos los triggers conocidos de implementaciones anteriores.
drop trigger if exists t_sheet_interests_stats on public.sheet_interests;
drop trigger if exists trg_sheet_interest_count on public.sheet_interests;
drop trigger if exists t_sheet_interests_count on public.sheet_interests;

-- Eliminar implementaciones antiguas o duplicadas.
drop function if exists public.toggle_sheet_interest(bigint, text, text);
drop function if exists public.reset_sheet_interest(bigint);
drop function if exists public.update_sheet_interest_count();
drop function if exists public.refresh_sheet_interest_count();

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

create function public.reset_sheet_interest(p_sheet_id bigint)
returns boolean
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
    return false;
  end if;

  delete from public.sheet_interests
  where sheet_id = p_sheet_id;

  update public.sheets
  set interest_count = 0
  where id = p_sheet_id;

  return true;
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
  v_sheet public.sheets%rowtype;
  v_course_hidden boolean;
  v_deleted_id bigint;
  v_is_interested boolean;
  v_has_solution boolean;
  v_new_count bigint;
  v_status text;
begin
  -- Validar parámetros obligatorios.
  if p_sheet_id is null or p_sheet_id <= 0 then
    return json_build_object(
      'status', 'INVALID_REQUEST',
      'interested', false,
      'interest_count', 0,
      'is_hidden', false,
      'has_solution', false
    );
  end if;

  if p_device_id is null then
    return json_build_object(
      'status', 'INVALID_REQUEST',
      'interested', false,
      'interest_count', 0,
      'is_hidden', false,
      'has_solution', false
    );
  end if;

  if nullif(btrim(p_ip_hash), '') is null then
    return json_build_object(
      'status', 'INVALID_REQUEST',
      'interested', false,
      'interest_count', 0,
      'is_hidden', false,
      'has_solution', false
    );
  end if;

  select *
  into v_sheet
  from public.sheets
  where id = p_sheet_id
  for update;

  if not found then
    return json_build_object(
      'status', 'NOT_FOUND',
      'interested', false,
      'interest_count', 0,
      'is_hidden', false,
      'has_solution', false
    );
  end if;

  v_has_solution :=
    (
      v_sheet.solution_kind = 'pdf'
      and nullif(
        btrim(v_sheet.solution_storage_path),
        ''
      ) is not null
    )
    or
    (
      v_sheet.solution_kind = 'video'
      and nullif(
        btrim(v_sheet.solution_video_url),
        ''
      ) is not null
    );

  select coalesce(c.is_hidden, false)
  into v_course_hidden
  from public.courses as c
  where c.id = v_sheet.course_id;

  if coalesce(v_sheet.is_hidden, false) or coalesce(v_course_hidden, false) then
    return json_build_object(
      'status', 'HIDDEN',
      'interested', false,
      'interest_count', coalesce(v_sheet.interest_count, 0),
      'is_hidden', true,
      'has_solution', v_has_solution
    );
  end if;

  if v_has_solution then
    return json_build_object(
      'status', 'SOLUTION_AVAILABLE',
      'interested', false,
      'interest_count', coalesce(v_sheet.interest_count, 0),
      'is_hidden', false,
      'has_solution', true
    );
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
    v_status := 'REGISTERED';
  else
    v_is_interested := false;
    v_status := 'REMOVED';
  end if;

  select coalesce(s.interest_count, 0)
  into v_new_count
  from public.sheets as s
  where s.id = p_sheet_id;

  return json_build_object(
    'status', v_status,
    'interested', v_is_interested,
    'interest_count', coalesce(v_new_count, 0),
    'is_hidden', false,
    'has_solution', false
  );
end;
$$;


/*
 * Registra el solucionario y reinicia los intereses en una sola transacción.
 * Si se proporciona p_exam_storage_path, también actualiza la plancha (caso AMBOS).
 */
create or replace function public.register_sheet_solution(
  p_sheet_id bigint,
  p_solution_storage_path text,
  p_exam_storage_path text default null,
  p_thumb_storage_path text default null,
  p_evaluation_id integer default null,
  p_exam_type text default null,
  p_teacher_id bigint default null,
  p_teacher_hint text default null,
  p_is_teacher_specific boolean default null
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_sheet_id is null
    or p_sheet_id <= 0
    or nullif(btrim(p_solution_storage_path), '') is null then
    return false;
  end if;

  perform 1
  from public.sheets
  where id = p_sheet_id
  for update;

  if not found then
    return false;
  end if;

  if p_exam_storage_path is not null then
    update public.sheets
    set
      evaluation_id = coalesce(p_evaluation_id, evaluation_id),
      exam_type = coalesce(nullif(btrim(p_exam_type), ''), exam_type),
      exam_storage_path = p_exam_storage_path,
      teacher_id = p_teacher_id,
      teacher_hint = p_teacher_hint,
      is_teacher_specific = coalesce(p_is_teacher_specific, is_teacher_specific),
      thumb_storage_path = coalesce(
        nullif(btrim(p_thumb_storage_path), ''),
        thumb_storage_path
      ),
      solution_kind = 'pdf',
      solution_storage_path = p_solution_storage_path,
      solution_video_url = null
    where id = p_sheet_id;
  else
    update public.sheets
    set
      solution_kind = 'pdf',
      solution_storage_path = p_solution_storage_path,
      solution_video_url = null
    where id = p_sheet_id;
  end if;

  delete from public.sheet_interests
  where sheet_id = p_sheet_id;

  update public.sheets
  set interest_count = 0
  where id = p_sheet_id;

  return true;
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

grant execute
on function public.register_sheet_solution(
  bigint,
  text,
  text,
  text,
  integer,
  text,
  bigint,
  text,
  boolean
)
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

revoke execute
on function public.register_sheet_solution(
  bigint,
  text,
  text,
  text,
  integer,
  text,
  bigint,
  text,
  boolean
)
from public, anon, authenticated;

commit;
