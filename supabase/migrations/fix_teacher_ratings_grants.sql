-- Revocar lectura directa de la tabla base para evitar exponer datos de reseñas anónimas
REVOKE SELECT ON public.teacher_ratings FROM anon, authenticated;

-- Crear vista pública que enmascara los datos si la reseña es anónima
CREATE OR REPLACE VIEW public.public_teacher_ratings AS
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
  tr.status,
  tr.is_anonymous,
  CASE WHEN tr.is_anonymous THEN null ELSE tr.user_id END as user_id,
  CASE WHEN tr.is_anonymous THEN 'Anónimo' ELSE tr.user_name END as user_name,
  CASE WHEN tr.is_anonymous THEN null ELSE tr.user_email END as user_email,
  CASE WHEN tr.is_anonymous THEN null ELSE sd.avatar_url END as avatar_url
FROM public.teacher_ratings tr
LEFT JOIN public.student_details sd ON tr.user_id = sd.user_id;

-- Dar permisos explícitos de lectura a los roles públicos sobre la vista
GRANT SELECT ON public.public_teacher_ratings TO anon, authenticated;

-- Mantener el permiso de lectura en la tabla teachers
GRANT SELECT ON public.teachers TO anon, authenticated;
