-- DDL para el módulo de mallas curriculares: study_plans, plan_courses y course_prerequisites

-- 1. Tabla study_plans
CREATE TABLE IF NOT EXISTS study_plans (
  id SERIAL PRIMARY KEY,
  specialty_id INT NOT NULL REFERENCES specialties(id) ON DELETE CASCADE,
  year VARCHAR(20) NOT NULL,
  is_current BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para optimizar consultas de mallas por especialidad y vigencia
CREATE INDEX IF NOT EXISTS idx_study_plans_specialty ON study_plans(specialty_id);
CREATE INDEX IF NOT EXISTS idx_study_plans_is_current ON study_plans(is_current);

-- 2. Tabla plan_courses (Cursos pertenecientes a un plan de estudios)
CREATE TABLE IF NOT EXISTS plan_courses (
  id SERIAL PRIMARY KEY,
  plan_id INT NOT NULL REFERENCES study_plans(id) ON DELETE CASCADE,
  course_id INT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  cycle INT NOT NULL,
  row_index INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_plan_course UNIQUE (plan_id, course_id)
);

-- Índices para búsquedas de cursos por plan
CREATE INDEX IF NOT EXISTS idx_plan_courses_plan_id ON plan_courses(plan_id);
CREATE INDEX IF NOT EXISTS idx_plan_courses_course_id ON plan_courses(course_id);

-- 3. Tabla course_prerequisites (Prerrequisitos de cursos en un plan)
CREATE TABLE IF NOT EXISTS course_prerequisites (
  id SERIAL PRIMARY KEY,
  plan_id INT NOT NULL REFERENCES study_plans(id) ON DELETE CASCADE,
  course_id INT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  prerequisite_id INT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_course_prerequisite UNIQUE (plan_id, course_id, prerequisite_id)
);

-- Índices para búsquedas rápidas de prerrequisitos
CREATE INDEX IF NOT EXISTS idx_course_prerequisites_plan ON course_prerequisites(plan_id);
CREATE INDEX IF NOT EXISTS idx_course_prerequisites_course ON course_prerequisites(course_id);

-- 4. Habilitar RLS (Row Level Security)
ALTER TABLE study_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_prerequisites ENABLE ROW LEVEL SECURITY;

-- 5. Políticas de acceso (RLS Policies)

-- Políticas de lectura pública
DROP POLICY IF EXISTS "Public read study_plans" ON study_plans;
CREATE POLICY "Public read study_plans" ON study_plans FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read plan_courses" ON plan_courses;
CREATE POLICY "Public read plan_courses" ON plan_courses FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read course_prerequisites" ON course_prerequisites;
CREATE POLICY "Public read course_prerequisites" ON course_prerequisites FOR SELECT USING (true);

-- Políticas de administración para usuarios autenticados (Admin)
DROP POLICY IF EXISTS "Admin write study_plans" ON study_plans;
CREATE POLICY "Admin write study_plans" ON study_plans FOR ALL USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Admin write plan_courses" ON plan_courses;
CREATE POLICY "Admin write plan_courses" ON plan_courses FOR ALL USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Admin write course_prerequisites" ON course_prerequisites;
CREATE POLICY "Admin write course_prerequisites" ON course_prerequisites FOR ALL USING (auth.role() = 'authenticated');
