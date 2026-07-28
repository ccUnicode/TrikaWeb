-- Migración: agregar perfiles de usuario y sincronización con Auth
-- Crea perfiles, datos estudiantiles, rol administrativo y trigger de auth.users.
-- Diseñada para ejecutarse sobre el schema original entregado al equipo.

begin;


do $$
begin
  if not exists (
    select 1
    from pg_type as t
    join pg_namespace as n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'user_role'
  ) then
    create type public.user_role as enum ('student', 'admin');
  end if;
end
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
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

create unique index if not exists uq_profiles_username_lower
  on public.profiles (lower(username))
  where username is not null and btrim(username) <> '';

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

CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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

CREATE OR REPLACE FUNCTION "public"."is_current_user_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select exists (
    select 1
    from public.profiles as p
    where p.id = auth.uid()
      and p.role = 'admin'::public.user_role
  );
$$;


-- Completar perfiles de usuarios existentes sin sobrescribir roles asignados.
insert into public.profiles (id, email, full_name, role)
select
  u.id,
  u.email,
  coalesce(u.raw_user_meta_data ->> 'full_name', ''),
  'student'::public.user_role
from auth.users as u
on conflict (id) do update
set email = excluded.email;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.student_details enable row level security;

drop policy if exists profiles_select_own on public.profiles;
drop policy if exists profiles_update_own on public.profiles;
drop policy if exists student_details_select_all on public.student_details;
drop policy if exists student_details_update_own on public.student_details;

create policy profiles_select_own
on public.profiles
for select to authenticated
using (auth.uid() = id);

create policy profiles_update_own
on public.profiles
for update to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

-- student_details queda reservado para procesos backend.
revoke all privileges on table public.profiles, public.student_details
from public, anon, authenticated;

grant all privileges on table public.profiles, public.student_details
  to service_role;

grant select on public.profiles to authenticated;
grant update (email, full_name, username, avatar_url)
  on public.profiles to authenticated;

grant execute on function public.is_current_user_admin() to authenticated;

revoke execute on function public.handle_new_user()
  from public, anon, authenticated;
revoke execute on function public.set_updated_at()
  from public, anon, authenticated;

commit;
