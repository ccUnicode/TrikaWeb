-- Migración 15
-- Consolidar perfiles de usuario y sincronización con Auth
--
-- Consolida las migraciones históricas de profiles y student_details.
-- Convierte profiles.role de text a public.user_role cuando sea necesario,
-- sin sobrescribir roles ya asignados.
--
-- Debe ejecutarse después de:
--   03_add_student_profiles.sql
--   05_add_specialties.sql
--   06_add_student_details.sql
--   13_update_student_details_grants_and_fk.sql
--   14_remove_email_from_public_ratings.sql

begin;

-- Crear el enum únicamente si todavía no existe.
do $$
begin
  if not exists (
    select 1
    from pg_type as t
    join pg_namespace as n
      on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'user_role'
  ) then
    create type public.user_role as enum ('student', 'admin');
  end if;
end
$$;

-- Las tablas pueden haber sido creadas por migraciones anteriores.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text not null default '',
  role public.user_role not null default 'student',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  username text,
  avatar_url text,
  specialty text
);

create table if not exists public.student_details (
  user_id text primary key,
  email text,
  full_name text,
  avatar_url text,
  specialty text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Completar columnas que podrían faltar en instalaciones antiguas.
alter table public.profiles
  add column if not exists email text,
  add column if not exists full_name text not null default '',
  add column if not exists role public.user_role,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists username text,
  add column if not exists avatar_url text,
  add column if not exists specialty text;

alter table public.student_details
  add column if not exists email text,
  add column if not exists full_name text,
  add column if not exists avatar_url text,
  add column if not exists specialty text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

-- Normalizar valores vacíos antes de convertir el tipo.
update public.profiles
set role = 'student'
where role is null
   or nullif(btrim(role::text), '') is null;

-- Detener la migración si existen valores fuera del catálogo.
do $$
begin
  if exists (
    select 1
    from public.profiles
    where lower(btrim(role::text)) not in ('student', 'admin')
  ) then
    raise exception
      'No se puede convertir profiles.role: existen valores distintos de student/admin.';
  end if;
end
$$;

-- La migración 03 creó role como text. Convertirlo al enum solo cuando
-- la columna todavía no usa public.user_role.
do $$
declare
  role_schema text;
  role_type text;
begin
  select
    type_namespace.nspname,
    role_type_def.typname
  into
    role_schema,
    role_type
  from pg_attribute as attribute
  join pg_class as relation
    on relation.oid = attribute.attrelid
  join pg_namespace as relation_namespace
    on relation_namespace.oid = relation.relnamespace
  join pg_type as role_type_def
    on role_type_def.oid = attribute.atttypid
  join pg_namespace as type_namespace
    on type_namespace.oid = role_type_def.typnamespace
  where relation_namespace.nspname = 'public'
    and relation.relname = 'profiles'
    and attribute.attname = 'role'
    and attribute.attnum > 0
    and not attribute.attisdropped;

  if role_schema is distinct from 'public'
     or role_type is distinct from 'user_role' then
    alter table public.profiles
      alter column role drop default;

    alter table public.profiles
      drop constraint if exists profiles_role_check;

    alter table public.profiles
      alter column role type public.user_role
      using lower(btrim(role::text))::public.user_role;
  end if;
end
$$;

alter table public.profiles
  alter column role set default 'student'::public.user_role,
  alter column role set not null;

create unique index if not exists uq_profiles_username_lower
  on public.profiles (lower(username))
  where username is not null
    and btrim(username) <> '';

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
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
$$;

create or replace function public.is_current_user_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles as profile
    where profile.id = auth.uid()
      and profile.role = 'admin'::public.user_role
  );
$$;

-- Completar perfiles de usuarios existentes sin sobrescribir roles.
insert into public.profiles (
  id,
  email,
  full_name,
  role
)
select
  auth_user.id,
  auth_user.email,
  coalesce(auth_user.raw_user_meta_data ->> 'full_name', ''),
  'student'::public.user_role
from auth.users as auth_user
on conflict (id) do update
set email = excluded.email;

drop trigger if exists set_profiles_updated_at
  on public.profiles;

create trigger set_profiles_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

drop trigger if exists on_auth_user_created
  on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

alter table public.profiles
  enable row level security;

alter table public.student_details
  enable row level security;

drop policy if exists profiles_insert_own
  on public.profiles;

drop policy if exists profiles_select_own
  on public.profiles;

drop policy if exists profiles_update_own
  on public.profiles;

drop policy if exists student_details_select_all
  on public.student_details;

drop policy if exists student_details_update_own
  on public.student_details;

create policy profiles_select_own
on public.profiles
for select
to authenticated
using (auth.uid() = id);

create policy profiles_update_own
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

-- student_details queda reservado para procesos backend.
revoke all privileges
on table public.profiles, public.student_details
from public, anon, authenticated;

grant all privileges
on table public.profiles, public.student_details
to service_role;

grant select
on table public.profiles
to authenticated;

grant update (
  email,
  full_name,
  username,
  avatar_url
)
on table public.profiles
to authenticated;

revoke execute
on function public.is_current_user_admin()
from public, anon;

grant execute
on function public.is_current_user_admin()
to authenticated, service_role;

revoke execute
on function public.handle_new_user()
from public, anon, authenticated, service_role;

revoke execute
on function public.set_updated_at()
from public, anon, authenticated, service_role;

commit;
