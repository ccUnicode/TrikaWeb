-- Migración 9
-- Ejecutar en el SQL Editor de Supabase
-- Permite que todos los estudiantes puedan ver las reseñas de los profesores
DROP POLICY IF EXISTS "ratings_select_all" ON public.teacher_ratings;
CREATE POLICY "ratings_select_all" ON public.teacher_ratings FOR SELECT USING (true);

-- IMPORTANTE: No se permite INSERT público.
-- Las inserciones se manejan únicamente desde el endpoint usando service_role
-- para garantizar el rate limit y moderación.
DROP POLICY IF EXISTS "ratings_insert_all" ON public.teacher_ratings;
