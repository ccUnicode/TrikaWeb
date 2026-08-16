CREATE OR REPLACE FUNCTION add_malla_transaction(payload JSONB)
RETURNS JSONB AS $$
DECLARE
  v_specialty_id UUID;
  v_year TEXT;
  v_is_current BOOLEAN;
  new_plan RECORD;
BEGIN
  v_specialty_id := (payload->>'specialty_id')::UUID;
  v_year := payload->>'year';
  v_is_current := (payload->>'is_current')::BOOLEAN;

  -- 1. Si la nueva malla es vigente, desmarcamos las anteriores de la misma especialidad
  IF v_is_current THEN
    UPDATE study_plans SET is_current = false WHERE specialty_id = v_specialty_id;
  END IF;

  -- 2. Insertamos la nueva malla
  INSERT INTO study_plans (specialty_id, year, is_current)
  VALUES (v_specialty_id, v_year, v_is_current)
  RETURNING * INTO new_plan;

  -- Devolvemos la nueva malla creada
  RETURN row_to_json(new_plan)::JSONB;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Revocar permisos públicos y de usuarios autenticados para evitar modificaciones sin privilegios
REVOKE EXECUTE ON FUNCTION add_malla_transaction(JSONB) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION add_malla_transaction(JSONB) FROM authenticated;
-- Otorgar permiso de ejecución únicamente a service_role (usado por supabaseAdmin)
GRANT EXECUTE ON FUNCTION add_malla_transaction(JSONB) TO service_role;
