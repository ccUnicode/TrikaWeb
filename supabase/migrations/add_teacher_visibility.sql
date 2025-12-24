-- Migración para agregar gestión de visibilidad a profesores
-- Ejecutar en Supabase SQL Editor

-- Agregar campo is_hidden a la tabla teachers
ALTER TABLE teachers 
  ADD COLUMN IF NOT EXISTS is_hidden boolean NOT NULL DEFAULT false;

-- Agregar campo avatar_url si no existe (ya existe según data.ts pero por seguridad)
ALTER TABLE teachers 
  ADD COLUMN IF NOT EXISTS avatar_url text;

-- Crear índice para búsquedas de profesores visibles
CREATE INDEX IF NOT EXISTS idx_teachers_is_hidden 
  ON teachers (is_hidden);

-- Actualizar policy para que solo muestre profesores visibles públicamente
-- Primero eliminamos la policy existente
DROP POLICY IF EXISTS "public read teachers" ON teachers;

-- Creamos nueva policy que filtra profesores ocultos
CREATE POLICY "public read visible teachers" ON teachers
  FOR SELECT USING (is_hidden = false);

-- Policy separada para admins (usando service_role que bypasea RLS)
-- Los admins usan la service key así que pueden ver todos
