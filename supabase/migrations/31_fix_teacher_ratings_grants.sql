-- Migración 31: Permitir lectura RLS en teacher_ratings y student_details para security_invoker views
-- Ejecutar en el SQL Editor de Supabase

GRANT SELECT ON public.teacher_ratings TO anon, authenticated;
GRANT SELECT ON public.student_details TO anon, authenticated;
