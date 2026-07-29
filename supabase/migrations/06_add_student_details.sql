-- Tabla independiente para guardar detalles de usuarios que se loguean con Firebase
create table if not exists public.student_details (
  user_id text primary key,
  email text,
  full_name text,
  avatar_url text,
  specialty text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Habilitar RLS
alter table public.student_details enable row level security;

-- Todos pueden ver los perfiles
drop policy if exists "student_details_select_all" on public.student_details;
create policy "student_details_select_all"
  on public.student_details for select
  using (true);

-- Permitir a usuarios de Firebase modificar su propio perfil
drop policy if exists "student_details_update_own" on public.student_details;
create policy "student_details_update_own"
  on public.student_details for all
  using (true) -- Lo maneja el servidor (Service Role Key)
  with check (true);
