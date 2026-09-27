-- Migración 31: Permitir lectura RLS en teacher_ratings y student_details para security_invoker views
-- Ejecutar en el SQL Editor de Supabase

GRANT SELECT (id, teacher_id, overall, is_hidden, needs_review) ON public.teacher_ratings TO anon, authenticated;
