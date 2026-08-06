-- Migración 7
-- Añadir la columna user_id a teacher_ratings para poder enlazar a perfiles públicos
ALTER TABLE public.teacher_ratings
  ADD COLUMN IF NOT EXISTS user_id text;
