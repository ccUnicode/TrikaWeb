CREATE OR REPLACE FUNCTION save_malla_transaction(p_plan_id UUID, p_placed_courses JSONB)
RETURNS VOID AS $$
DECLARE
  course RECORD;
  prereq_id INT;
BEGIN
  -- 1. Eliminar pre-requisitos previos
  DELETE FROM course_prerequisites WHERE plan_id = p_plan_id;
  
  -- 2. Eliminar los cursos previos de este plan
  DELETE FROM plan_courses WHERE plan_id = p_plan_id;

  -- 3. Insertar los nuevos cursos y sus pre-requisitos
  IF p_placed_courses IS NOT NULL AND jsonb_array_length(p_placed_courses) > 0 THEN
    FOR course IN SELECT * FROM jsonb_to_recordset(p_placed_courses) AS x(course_id INT, cycle INT, row_index INT, prerequisites JSONB) LOOP
      
      -- Insertar curso
      INSERT INTO plan_courses (plan_id, course_id, cycle, row_index)
      VALUES (p_plan_id, course.course_id, course.cycle, course.row_index);
      
      -- Insertar pre-requisitos si existen
      IF course.prerequisites IS NOT NULL AND jsonb_array_length(course.prerequisites) > 0 THEN
        FOR prereq_id IN SELECT * FROM jsonb_array_elements_text(course.prerequisites) LOOP
          INSERT INTO course_prerequisites (plan_id, course_id, prerequisite_id)
          VALUES (p_plan_id, course.course_id, CAST(prereq_id AS INT));
        END LOOP;
      END IF;
      
    END LOOP;
  END IF;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Revocar permisos públicos y de usuarios autenticados para evitar modificaciones sin privilegios
REVOKE EXECUTE ON FUNCTION save_malla_transaction(UUID, JSONB) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION save_malla_transaction(UUID, JSONB) FROM authenticated;
-- Otorgar permiso de ejecución únicamente a service_role (usado por supabaseAdmin)
GRANT EXECUTE ON FUNCTION save_malla_transaction(UUID, JSONB) TO service_role;
