-- Migración 12
-- Limpieza de políticas y permisos antiguos en la tabla contributions

-- 1. Revocar los permisos de SELECT e INSERT directos en toda la tabla 
-- (para limpiar cualquier GRANT ALL o GRANT SELECT general previo)
REVOKE ALL ON public.contributions FROM anon, authenticated;

-- 2. Eliminar cualquier política de inserción que permitía a los usuarios saltarse el service_role
DROP POLICY IF EXISTS "contributions_insert_own" ON public.contributions;
DROP POLICY IF EXISTS "contributions_insert" ON public.contributions;
DROP POLICY IF EXISTS "Los usuarios pueden insertar sus propios aportes" ON public.contributions;
DROP POLICY IF EXISTS "Permitir a los usuarios insertar sus aportes" ON public.contributions;
DROP POLICY IF EXISTS "Insertar aportes" ON public.contributions;

-- 3. Volver a otorgar explícitamente solo SELECT por columnas seguras
GRANT SELECT (id, user_id, user_name, course_id, cycle, exam_type, contribution_type, status, admin_notes, created_at, updated_at) ON public.contributions TO anon, authenticated;

-- Las políticas de lectura ya fueron recreadas en 11_add_contributions.sql, así que se mantienen.
