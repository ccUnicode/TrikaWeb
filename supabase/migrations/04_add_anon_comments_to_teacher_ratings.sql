-- Migración 4
-- Migración para soportar comentarios anónimos con visibilidad de autor para admins
-- Ejecutar en el SQL Editor de tu Dashboard de Supabase

ALTER TABLE teacher_ratings 
  ADD COLUMN IF NOT EXISTS is_anonymous boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS user_name text,
  ADD COLUMN IF NOT EXISTS user_email text;
