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
