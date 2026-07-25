-- Migración para crear la tabla sheet_feedback y la función get_average_stars
-- Ejecutar en Supabase SQL Editor

-- Crear la tabla sheet_feedback
CREATE TABLE IF NOT EXISTS sheet_feedback (
  id BIGSERIAL PRIMARY KEY,
  sheet_id BIGINT NOT NULL REFERENCES sheets(id) ON DELETE CASCADE,
  device_id UUID NOT NULL,
  stars INTEGER NOT NULL CHECK (stars >= 1 AND stars <= 5),
  content TEXT,
  ip_hash TEXT NOT NULL,
  is_hidden BOOLEAN NOT NULL DEFAULT false,
  needs_review BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Agregar restricción única para que un dispositivo solo tenga un feedback por plancha
ALTER TABLE sheet_feedback 
  ADD CONSTRAINT sheet_feedback_sheet_id_device_id_key UNIQUE (sheet_id, device_id);

-- Crear índices para búsquedas
CREATE INDEX IF NOT EXISTS idx_sheet_feedback_sheet_id ON sheet_feedback (sheet_id);
CREATE INDEX IF NOT EXISTS idx_sheet_feedback_is_hidden ON sheet_feedback (is_hidden);

-- Habilitar RLS
ALTER TABLE sheet_feedback ENABLE ROW LEVEL SECURITY;

-- Crear policy para lectura pública de feedbacks visibles
CREATE POLICY "public read visible sheet feedback" ON sheet_feedback
  FOR SELECT USING (is_hidden = false);

-- Crear función para obtener el promedio de estrellas
CREATE OR REPLACE FUNCTION get_average_stars(p_sheet_id BIGINT)
RETURNS NUMERIC AS $$
DECLARE
  avg_val NUMERIC;
BEGIN
  SELECT COALESCE(ROUND(AVG(stars)::NUMERIC, 2), 0)
  INTO avg_val
  FROM sheet_feedback
  WHERE sheet_id = p_sheet_id AND is_hidden = false;
  
  RETURN avg_val;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Otorgar permisos básicos
GRANT SELECT ON sheet_feedback TO anon, authenticated;
