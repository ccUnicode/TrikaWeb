-- Migración 29: Añadir columnas de usuario a sheet_feedback

ALTER TABLE public.sheet_feedback 
  ADD COLUMN IF NOT EXISTS user_id uuid,
  ADD COLUMN IF NOT EXISTS user_name text,
  ADD COLUMN IF NOT EXISTS user_email text,
  ADD COLUMN IF NOT EXISTS user_avatar text,
  ADD COLUMN IF NOT EXISTS is_anonymous boolean NOT NULL DEFAULT false;

-- Agregar llave foránea para conectar con student_details
ALTER TABLE public.sheet_feedback 
  ADD CONSTRAINT sheet_feedback_user_id_fkey 
  FOREIGN KEY (user_id) 
  REFERENCES public.student_details(user_id) 
  ON DELETE SET NULL;

-- 1. Eliminar el constraint UNIQUE que limitaba a 1 comentario por device_id por plancha
ALTER TABLE public.sheet_feedback 
  DROP CONSTRAINT IF EXISTS sheet_feedback_sheet_id_device_id_key;

-- 2. Eliminar la columna stars (ya no es parte del sistema)
ALTER TABLE public.sheet_feedback 
  DROP COLUMN IF EXISTS stars;

-- 3. Crear tabla de reacciones emoji para comentarios
CREATE TABLE IF NOT EXISTS public.sheet_feedback_reactions (
  id BIGSERIAL PRIMARY KEY,
  feedback_id BIGINT NOT NULL REFERENCES public.sheet_feedback(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  reaction TEXT NOT NULL CHECK (reaction IN ('like', 'love', 'haha', 'wow', 'sad')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT sheet_feedback_reactions_unique UNIQUE (feedback_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_feedback_reactions_feedback_id 
  ON public.sheet_feedback_reactions(feedback_id);

ALTER TABLE public.sheet_feedback_reactions ENABLE ROW LEVEL SECURITY;

-- 4. Notificar a PostgREST para recargar el esquema
NOTIFY pgrst, 'reload schema';
