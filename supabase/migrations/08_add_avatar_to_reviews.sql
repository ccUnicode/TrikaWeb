-- Migración 8
-- Dar permisos de lectura a student_details solo en columnas públicas
GRANT SELECT (user_id, full_name, avatar_url, specialty) ON public.student_details TO anon, authenticated;

-- Agregar llave foránea para conectar las reseñas con los detalles del estudiante
ALTER TABLE public.teacher_ratings 
  ADD CONSTRAINT teacher_ratings_user_id_fkey 
  FOREIGN KEY (user_id) 
  REFERENCES public.student_details(user_id) 
  ON DELETE SET NULL;
