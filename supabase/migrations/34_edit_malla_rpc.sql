CREATE OR REPLACE FUNCTION edit_malla_transaction(payload JSONB)
RETURNS VOID AS $$
DECLARE
  v_id UUID;
  v_specialty_id UUID;
  v_year TEXT;
  v_is_current BOOLEAN;
BEGIN
  v_id := (payload->>'id')::UUID;
  v_specialty_id := (payload->>'specialty_id')::UUID;
  v_year := payload->>'year';
  v_is_current := (payload->>'is_current')::BOOLEAN;

  -- 1. Si la malla se actualiza a vigente, desmarcamos las demás de la misma especialidad
  IF v_is_current THEN
    UPDATE study_plans 
    SET is_current = false 
    WHERE specialty_id = v_specialty_id AND id != v_id;
  END IF;

  -- 2. Actualizamos la malla objetivo
  UPDATE study_plans 
  SET year = v_year, is_current = v_is_current
  WHERE id = v_id;
  
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Revocar permisos públicos y de usuarios autenticados para evitar modificaciones sin privilegios
REVOKE EXECUTE ON FUNCTION edit_malla_transaction(JSONB) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION edit_malla_transaction(JSONB) FROM authenticated;
-- Otorgar permiso de ejecución únicamente a service_role (usado por supabaseAdmin)
GRANT EXECUTE ON FUNCTION edit_malla_transaction(JSONB) TO service_role;
