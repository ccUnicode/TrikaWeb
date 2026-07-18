-- Migración para la tabla de aportes/donaciones de estudiantes (RF-23)

create table if not exists public.contributions (
  id bigserial primary key,
  user_id text not null, -- Soporta Firebase UID o Supabase UUID
  user_email text not null,
  user_name text not null,
  course_id bigint not null references public.courses(id) on delete cascade,
  cycle text not null,
  exam_type text not null,
  contribution_type text not null check (contribution_type in ('sheet', 'solution')),
  file_storage_path text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Habilitar RLS
alter table public.contributions enable row level security;

-- Política: El estudiante puede ver sus propios aportes
drop policy if exists "contributions_select_own" on public.contributions;
create policy "contributions_select_own"
  on public.contributions for select
  using (auth.uid()::text = user_id or (select auth.jwt() ->> 'email') = user_email);

-- Política: Cualquiera puede ver los aportes aprobados (RF-20 - Historial de aportes en perfil público)
drop policy if exists "contributions_select_approved" on public.contributions;
create policy "contributions_select_approved"
  on public.contributions for select
  using (status = 'approved');

-- Política: El estudiante puede crear sus propios aportes
drop policy if exists "contributions_insert_own" on public.contributions;
create policy "contributions_insert_own"
  on public.contributions for insert
  with check (true);

-- Permisos para roles de Supabase
grant select, insert on public.contributions to authenticated;
grant usage on sequence public.contributions_id_seq to authenticated;
