-- Migración 38
-- Malla curricular de Ingeniería de Inteligencia Artificial (cursos obligatorios, ciclos 1 a 10).
--
-- 1. Crea los cursos de IA que aún no existen en public.courses (28 cursos).
--    Se crean como INCOMPLETO con sistema de evaluación provisional G (system_id = 7),
--    igual que en la migración 17. El sistema real debe corregirse desde el panel admin.
-- 2. Llena el plan de estudios ya existente de IA (año '2025') con 60 cursos obligatorios
--    y sus prerrequisitos. Los cursos compartidos con otras carreras (BMA01, SW303, etc.)
--    se reutilizan por código.
--
-- Fuente: malla curricular oficial de Ingeniería de Inteligencia Artificial.
-- Correcciones confirmadas sobre la fuente:
--   - IA005: la fuente indica IA022 como prerrequisito (errata). Se usa IA002.
--   - SW303: la fuente indica SW303 (a sí mismo). Se usa SI205.
--   - GE804 se crea como curso nuevo (distinto de GS804 de la malla de Software).
-- Los cursos electivos NO se incluyen (ninguna malla actual incluye electivos).
--
-- Es una migración de DATOS para la base existente: requiere que el plan 2025 de IA y los
-- cursos compartidos ya existan. No forma parte de la instalación sobre una base vacía.
--
-- Por seguridad, si el plan de IA ya tiene cursos cargados (por ejemplo desde el builder),
-- la migración se detiene sin modificar nada. Todo se ejecuta en una sola transacción.

begin;

-- ============================================================================
-- 1. Cursos nuevos de la carrera de IA
-- ============================================================================

insert into public.courses (
  code, name, credits, is_hidden, system_id, subsystem_id, summary, is_elective, avg_difficulty, status
)
values
  ('IA001', 'Introducción a la Ingeniería de Inteligencia Artificial', 2, false, 7, null, 'Falta actualizar el SISTEMA!', false, 0.00, 'INCOMPLETO'),
  ('IA002', 'Análisis de Datos Estadísticos', 3, false, 7, null, 'Falta actualizar el SISTEMA!', false, 0.00, 'INCOMPLETO'),
  ('IA004', 'Adquisición y Preprocesamiento de Datos (Ingeniería)', 3, false, 7, null, 'Falta actualizar el SISTEMA!', false, 0.00, 'INCOMPLETO'),
  ('IA005', 'Aprendizaje Automático I', 4, false, 7, null, 'Falta actualizar el SISTEMA!', false, 0.00, 'INCOMPLETO'),
  ('IA007', 'Aprendizaje Automático II', 4, false, 7, null, 'Falta actualizar el SISTEMA!', false, 0.00, 'INCOMPLETO'),
  ('IA008', 'Sistemas Multiagentes', 3, false, 7, null, 'Falta actualizar el SISTEMA!', false, 0.00, 'INCOMPLETO'),
  ('IA009', 'Visualización de Datos y Storytelling', 3, false, 7, null, 'Falta actualizar el SISTEMA!', false, 0.00, 'INCOMPLETO'),
  ('IA010', 'Redes Neuronales y Deep Learning', 3, false, 7, null, 'Falta actualizar el SISTEMA!', false, 0.00, 'INCOMPLETO'),
  ('IA011', 'Técnicas Avanzadas de Optimización', 3, false, 7, null, 'Falta actualizar el SISTEMA!', false, 0.00, 'INCOMPLETO'),
  ('IA012', 'Modelos Gráficos Probabilísticos', 3, false, 7, null, 'Falta actualizar el SISTEMA!', false, 0.00, 'INCOMPLETO'),
  ('IA013', 'Taller de Machine Learning', 2, false, 7, null, 'Falta actualizar el SISTEMA!', false, 0.00, 'INCOMPLETO'),
  ('IA014', 'Visión Artificial', 3, false, 7, null, 'Falta actualizar el SISTEMA!', false, 0.00, 'INCOMPLETO'),
  ('IA015', 'Computación Evolutiva', 3, false, 7, null, 'Falta actualizar el SISTEMA!', false, 0.00, 'INCOMPLETO'),
  ('IA016', 'Aprendizaje por Refuerzo', 3, false, 7, null, 'Falta actualizar el SISTEMA!', false, 0.00, 'INCOMPLETO'),
  ('IA017', 'Procesamiento del Lenguaje Natural', 3, false, 7, null, 'Falta actualizar el SISTEMA!', false, 0.00, 'INCOMPLETO'),
  ('IA018', 'Fundamentos de Mecatrónica', 3, false, 7, null, 'Falta actualizar el SISTEMA!', false, 0.00, 'INCOMPLETO'),
  ('IA019', 'Procesamiento de Señales', 3, false, 7, null, 'Falta actualizar el SISTEMA!', false, 0.00, 'INCOMPLETO'),
  ('IA020', 'Análisis de Datos Masivos (Big Data)', 3, false, 7, null, 'Falta actualizar el SISTEMA!', false, 0.00, 'INCOMPLETO'),
  ('IA021', 'Ética de Datos e Inteligencia Artificial', 2, false, 7, null, 'Falta actualizar el SISTEMA!', false, 0.00, 'INCOMPLETO'),
  ('IA022', 'Taller de Deep Learning', 2, false, 7, null, 'Falta actualizar el SISTEMA!', false, 0.00, 'INCOMPLETO'),
  ('IA023', 'Taller de Investigación de Ing. Inteligencia Artificial', 2, false, 7, null, 'Falta actualizar el SISTEMA!', false, 0.00, 'INCOMPLETO'),
  ('IA024', 'Taller de Proyectos de Investigación', 2, false, 7, null, 'Falta actualizar el SISTEMA!', false, 0.00, 'INCOMPLETO'),
  ('IA025', 'Taller de Investigación', 2, false, 7, null, 'Falta actualizar el SISTEMA!', false, 0.00, 'INCOMPLETO'),
  ('IA026', 'Tópicos Avanzados de Inteligencia Artificial', 2, false, 7, null, 'Falta actualizar el SISTEMA!', false, 0.00, 'INCOMPLETO'),
  ('IA027', 'Fabricación Digital', 3, false, 7, null, 'Falta actualizar el SISTEMA!', false, 0.00, 'INCOMPLETO'),
  ('GE804', 'Administración de Empresas de Software', 3, false, 7, null, 'Falta actualizar el SISTEMA!', false, 0.00, 'INCOMPLETO'),
  ('SW115', 'Computación Paralela', 3, false, 7, null, 'Falta actualizar el SISTEMA!', false, 0.00, 'INCOMPLETO'),
  ('SW122', 'Internet de las Cosas y Nanocosas', 3, false, 7, null, 'Falta actualizar el SISTEMA!', false, 0.00, 'INCOMPLETO')
on conflict (code) do nothing;

-- ============================================================================
-- 2. Ubicación de los cursos en la malla (ciclo y fila del lienzo)
-- ============================================================================

create temporary table ia_plan_courses (
  code text primary key,
  cycle integer not null,
  row_index integer not null
) on commit drop;

insert into ia_plan_courses (code, cycle, row_index)
values
  -- Ciclo 1
  ('BMA01', 1, 1), ('FB101', 1, 2), ('BIC01', 1, 6), ('IA001', 1, 7),
  ('BQU01', 1, 12), ('BRC01', 1, 13), ('HU102', 1, 14),
  -- Ciclo 2
  ('BMA02', 2, 1), ('BMA03', 2, 2), ('FB305', 2, 3), ('FB301', 2, 6),
  ('SI205', 2, 7), ('BRN01', 2, 13),
  -- Ciclo 3
  ('BFI01', 3, 1), ('FB303', 3, 2), ('IA002', 3, 3), ('SW301', 3, 6),
  ('SW303', 3, 7), ('SW305', 3, 8), ('BEG01', 3, 13),
  -- Ciclo 4
  ('FB401', 4, 1), ('FB403', 4, 2), ('IA005', 4, 3), ('SI405', 4, 7),
  ('SW403', 4, 8), ('SW405', 4, 9), ('BEF01', 4, 13),
  -- Ciclo 5
  ('FB402', 5, 2), ('IA007', 5, 3), ('IA008', 5, 4), ('SW407', 5, 6),
  ('SI505', 5, 7), ('SW603', 5, 8), ('HU501', 5, 14),
  -- Ciclo 6
  ('IA012', 6, 1), ('IA004', 6, 2), ('IA010', 6, 3), ('IA011', 6, 4),
  ('IA009', 6, 5), ('IA018', 6, 6), ('SW505', 6, 9),
  -- Ciclo 7
  ('IA019', 7, 2), ('IA014', 7, 3), ('IA013', 7, 4), ('IA021', 7, 5),
  ('IA027', 7, 6), ('GE804', 7, 9), ('SW115', 7, 10),
  -- Ciclo 8
  ('IA017', 8, 2), ('IA016', 8, 3), ('IA020', 8, 4), ('SW703', 8, 6),
  ('IA023', 8, 7), ('SW004', 8, 9),
  -- Ciclo 9
  ('IA022', 9, 2), ('SW122', 9, 6), ('IA015', 9, 7), ('IA024', 9, 8),
  -- Ciclo 10
  ('IA025', 10, 2), ('IA026', 10, 5);

-- ============================================================================
-- 3. Prerrequisitos (curso -> prerrequisito)
-- ============================================================================

create temporary table ia_prerequisites (
  code text not null,
  prerequisite_code text not null,
  primary key (code, prerequisite_code)
) on commit drop;

insert into ia_prerequisites (code, prerequisite_code)
values
  -- Ciclo 2
  ('BMA02', 'BMA01'), ('BMA03', 'FB101'), ('FB301', 'BIC01'), ('FB305', 'BMA01'),
  ('SI205', 'BIC01'), ('SI205', 'IA001'),
  -- Ciclo 3
  ('BFI01', 'BMA02'), ('FB303', 'BMA01'), ('FB303', 'BMA02'), ('IA002', 'FB305'),
  ('SW301', 'FB301'), ('SW303', 'SI205'), ('SW305', 'SI205'),
  -- Ciclo 4
  ('FB401', 'BFI01'), ('FB403', 'FB303'), ('IA005', 'IA002'), ('SI405', 'SW303'),
  ('SW403', 'SW305'), ('SW405', 'SW303'),
  -- Ciclo 5
  ('FB402', 'FB303'), ('FB402', 'SW403'), ('HU501', 'HU102'), ('IA007', 'IA005'),
  ('IA008', 'IA005'), ('SI505', 'SI405'), ('SW407', 'SW301'), ('SW603', 'SW403'),
  -- Ciclo 6
  ('IA004', 'IA007'), ('IA009', 'IA008'), ('IA010', 'IA007'), ('IA011', 'IA007'),
  ('IA012', 'IA005'), ('IA018', 'IA008'), ('SW505', 'SW405'),
  -- Ciclo 7
  ('GE804', 'SW505'), ('IA013', 'IA011'), ('IA014', 'IA010'), ('IA019', 'IA010'),
  ('IA021', 'IA009'), ('IA027', 'IA018'), ('SW115', 'SW505'),
  -- Ciclo 8
  ('IA016', 'IA014'), ('IA017', 'IA019'), ('IA020', 'IA011'), ('IA023', 'IA014'),
  ('SW004', 'GE804'), ('SW703', 'IA027'),
  -- Ciclo 9
  ('IA015', 'IA023'), ('IA022', 'IA017'), ('IA024', 'IA023'), ('SW122', 'SW703'),
  -- Ciclo 10
  ('IA025', 'IA022'), ('IA026', 'IA021');

-- ============================================================================
-- 4. Validaciones y carga del plan
-- ============================================================================

do $$
declare
  v_plan_id uuid;
  v_missing text;
  v_plan_count integer;
  v_existing integer;
begin
  -- Plan 2025 de Ingeniería de Inteligencia Artificial (ya creado desde el admin)
  select count(*), min(sp.id::text)::uuid
    into v_plan_count, v_plan_id
  from public.study_plans sp
  join public.specialties s on s.id = sp.specialty_id
  where s.name = 'Ingeniería de Inteligencia Artificial'
    and sp.year = '2025';

  if v_plan_count = 0 then
    raise exception 'No existe el plan 2025 de Ingeniería de Inteligencia Artificial';
  end if;

  if v_plan_count > 1 then
    raise exception 'Hay más de un plan 2025 de Ingeniería de Inteligencia Artificial';
  end if;

  -- No sobrescribir un plan que ya tenga contenido
  select count(*)
    into v_existing
  from public.plan_courses
  where plan_id = v_plan_id;

  if v_existing > 0 then
    raise exception 'El plan 2025 de IA ya tiene % cursos cargados. Revísalo antes de continuar.', v_existing;
  end if;

  -- Todos los códigos de la malla deben existir en courses
  select string_agg(t.code, ', ' order by t.code)
    into v_missing
  from ia_plan_courses t
  left join public.courses c on c.code = t.code
  where c.id is null;

  if v_missing is not null then
    raise exception 'Cursos de la malla que no existen en courses: %', v_missing;
  end if;

  -- Todo prerrequisito debe estar en la malla y en un ciclo anterior
  select string_agg(p.code || ' <- ' || p.prerequisite_code, ', ')
    into v_missing
  from ia_prerequisites p
  left join ia_plan_courses c on c.code = p.code
  left join ia_plan_courses r on r.code = p.prerequisite_code
  where c.code is null
     or r.code is null
     or r.cycle >= c.cycle;

  if v_missing is not null then
    raise exception 'Prerrequisitos inválidos: %', v_missing;
  end if;

  -- Cargar el plan
  insert into public.plan_courses (plan_id, course_id, cycle, row_index)
  select v_plan_id, c.id, t.cycle, t.row_index
  from ia_plan_courses t
  join public.courses c on c.code = t.code;

  insert into public.course_prerequisites (plan_id, course_id, prerequisite_id)
  select v_plan_id, c.id, r.id
  from ia_prerequisites p
  join public.courses c on c.code = p.code
  join public.courses r on r.code = p.prerequisite_code;
end;
$$;

commit;
