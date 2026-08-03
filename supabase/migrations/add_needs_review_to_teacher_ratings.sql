-- Agregar la columna needs_review a teacher_ratings para la moderación
ALTER TABLE teacher_ratings ADD COLUMN needs_review BOOLEAN NOT NULL DEFAULT true;
