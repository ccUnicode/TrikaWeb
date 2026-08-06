-- Migración 13
-- Corrección de permisos en student_details y FK idempotente

-- 1. Revocar el SELECT completo que se haya dado en versiones anteriores
REVOKE SELECT ON public.student_details FROM anon, authenticated;

-- 2. Volver a otorgar explícitamente el SELECT solo por las columnas seguras
GRANT SELECT (user_id, full_name, avatar_url, specialty) ON public.student_details TO anon, authenticated;

-- 3. Asegurar que la creación de la Foreign Key sea idempotente para que no falle si ya existe
ALTER TABLE public.teacher_ratings DROP CONSTRAINT IF EXISTS teacher_ratings_user_id_fkey;

ALTER TABLE public.teacher_ratings 
  ADD CONSTRAINT teacher_ratings_user_id_fkey 
  FOREIGN KEY (user_id) 
  REFERENCES public.student_details(user_id) 
  ON DELETE SET NULL;
