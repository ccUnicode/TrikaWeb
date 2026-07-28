-- ============================================================================
-- TrikaWeb - Agrega metadatos y estado administrativo a courses
-- Fecha: 2026-07-25
--
-- Esta migración aplica los cambios sobre una tabla courses ya existente.
-- El schema.sql conserva la definición completa para instalaciones nuevas.
-- ============================================================================

begin;

-- 1. Agregar las columnas sin afectar instalaciones donde ya existan.
alter table public.courses
  add column if not exists summary text,
  add column if not exists subsystem_id integer,
  add column if not exists status varchar(20),
  add column if not exists is_hidden boolean;

-- 2. Normalizar registros existentes antes de aplicar NOT NULL.
update public.courses
set status = 'INCOMPLETO'
where status is null;

update public.courses
set is_hidden = false
where is_hidden is null;

-- 3. Aplicar valores predeterminados y nulabilidad esperada.
alter table public.courses
  alter column status set default 'INCOMPLETO',
  alter column status set not null,
  alter column is_hidden set default false,
  alter column is_hidden set not null;

-- 4. Mantener únicamente los estados admitidos por la aplicación.
alter table public.courses
  drop constraint if exists courses_status_check;

alter table public.courses
  add constraint courses_status_check
  check (status in ('INCOMPLETO', 'COMPLETO', 'ARCHIVADO'));

-- 5. Validar la longitud de la sumilla cuando sea proporcionada.
alter table public.courses
  drop constraint if exists courses_summary_length_check;

alter table public.courses
  add constraint courses_summary_length_check
  check (
    summary is null
    or char_length(btrim(summary)) between 1 and 1000
  );

-- 6. Relacionar el subsistema del curso con su catálogo correspondiente.
alter table public.courses
  drop constraint if exists courses_subsystem_id_fkey;

alter table public.courses
  add constraint courses_subsystem_id_fkey
  foreign key (subsystem_id)
  references public.evaluation_subsystems(subsystem_id);

commit;
