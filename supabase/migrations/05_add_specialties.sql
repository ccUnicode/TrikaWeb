-- 1. Crear la tabla de especialidades
create table if not exists public.specialties (
    id uuid default gen_random_uuid() primary key,
    name text not null unique,
    created_at timestamptz not null default now()
);

-- 2. Habilitar RLS en specialties
alter table public.specialties enable row level security;

-- Permitir a todos leer las especialidades
drop policy if exists "specialties_select_all" on public.specialties;
create policy "specialties_select_all"
    on public.specialties for select
    using (true);

-- Solo el admin puede insertar/actualizar (por si lo agregan al panel de admin luego)
drop policy if exists "specialties_insert_admin" on public.specialties;
create policy "specialties_insert_admin"
    on public.specialties for insert
    with check (
        exists (
            select 1 from public.profiles
            where profiles.id = auth.uid() and profiles.role = 'admin'
        )
    );

-- 3. Insertar las 4 carreras base
insert into public.specialties (name) values
    ('Ingeniería Industrial'),
    ('Ingeniería de Sistemas'),
    ('Ingeniería de Software'),
    ('Ingeniería en Inteligencia Artificial')
on conflict (name) do nothing;

-- 4. Añadir columna a perfiles
alter table public.profiles add column if not exists specialty text;

-- (Opcional) Storage Bucket policies (el bucket se debe crear en el dashboard si no existe)
