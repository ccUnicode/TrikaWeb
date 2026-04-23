-- Migración: Permitir planchas por profesor específico
-- Fecha: 2026-04-20
-- Descripción:
--   Actualmente el índice único (course_id, cycle, lower(exam_type))
--   impide tener más de una plancha por curso+ciclo+tipo.
--   Esto bloquea subir planchas de profesores específicos (ej: PC1 de Física
--   del Prof. García vs PC1 de Física del Prof. López).
--
--   Esta migración:
--   1. Elimina el índice único anterior
--   2. Crea un nuevo índice que incluye teacher_hint, permitiendo variantes
--   3. Agrega columna is_teacher_specific para distinguir explícitamente

-- 1. Eliminar índice único anterior
DROP INDEX IF EXISTS uq_sheets_course_cycle_title;

-- 2. Crear nuevo índice único que incluye teacher_hint
--    COALESCE convierte NULL a '' para que la plancha "general" (sin profesor)
--    y las de profesor específico no colisionen
CREATE UNIQUE INDEX uq_sheets_course_cycle_type_teacher
  ON sheets (course_id, cycle, lower(exam_type), COALESCE(lower(teacher_hint), ''));

-- 3. Agregar columna para marcar planchas de profesor específico
ALTER TABLE sheets
  ADD COLUMN IF NOT EXISTS is_teacher_specific boolean NOT NULL DEFAULT false;

-- 4. Marcar como teacher_specific las planchas existentes que ya tengan teacher_hint
--    (excluyendo las que dicen "todos los profesores" o "todos")
UPDATE sheets
  SET is_teacher_specific = true
  WHERE teacher_hint IS NOT NULL
    AND lower(teacher_hint) NOT IN ('todos los profesores', 'todos');
