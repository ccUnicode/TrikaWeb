-- Dar permisos explícitos de lectura a los roles públicos
GRANT SELECT ON public.teacher_ratings TO anon, authenticated;
GRANT SELECT ON public.teachers TO anon, authenticated;
