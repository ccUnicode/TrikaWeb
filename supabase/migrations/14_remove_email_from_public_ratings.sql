-- Migración 14: Eliminar user_email de la vista pública de reseñas

-- 1. Eliminar la vista anterior para poder quitar una columna
DROP VIEW IF EXISTS public.public_teacher_ratings;

-- 2. Volver a crear la vista pública omitiendo por completo user_email
CREATE VIEW public.public_teacher_ratings AS
SELECT
  tr.id,
  tr.teacher_id,
  tr.overall,
  tr.difficulty,
  tr.didactic,
  tr.resources,
  tr.responsability,
  tr.grading,
  tr.comment,
  tr.created_at,
  tr.is_hidden,
  tr.is_anonymous,
  CASE WHEN tr.is_anonymous THEN null ELSE tr.user_id END as user_id,
  CASE WHEN tr.is_anonymous THEN 'Anónimo' ELSE tr.user_name END as user_name,
  CASE WHEN tr.is_anonymous THEN null ELSE sd.avatar_url END as avatar_url
FROM public.teacher_ratings tr
LEFT JOIN public.student_details sd ON tr.user_id = sd.user_id
WHERE tr.is_hidden = false;

-- 3. Otorgar permisos de lectura a los roles públicos
GRANT SELECT ON public.public_teacher_ratings TO anon, authenticated;
