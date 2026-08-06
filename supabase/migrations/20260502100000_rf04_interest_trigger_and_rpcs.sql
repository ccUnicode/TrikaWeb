-- ============================================================
-- RF-03/RF-04: Interest count trigger + atomic RPCs
-- ============================================================

-- 1. Trigger function: auto-update sheets.interest_count
--    after INSERT or DELETE on sheet_interests
CREATE OR REPLACE FUNCTION update_sheet_interest_count()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Increment or decrement based on the operation
  IF TG_OP = 'DELETE' THEN
    UPDATE sheets SET interest_count = GREATEST(0, interest_count - 1) WHERE id = OLD.sheet_id;
  ELSIF TG_OP = 'INSERT' THEN
    UPDATE sheets SET interest_count = interest_count + 1 WHERE id = NEW.sheet_id;
  END IF;

  RETURN NULL; -- AFTER trigger, return value is ignored
END;
$$;

-- 2. Trigger on sheet_interests
DROP TRIGGER IF EXISTS trg_sheet_interest_count ON sheet_interests;
CREATE TRIGGER trg_sheet_interest_count
  AFTER INSERT OR DELETE ON sheet_interests
  FOR EACH ROW
  EXECUTE FUNCTION update_sheet_interest_count();

-- 3. RPC: reset_sheet_interest (admin reset — atomic delete + update)
--    Locks the sheets row first to prevent concurrent toggles from
--    inserting while the reset is in progress.
CREATE OR REPLACE FUNCTION reset_sheet_interest(p_sheet_id bigint)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Lock the row to block concurrent toggles during the reset
  PERFORM 1 FROM sheets WHERE id = p_sheet_id FOR UPDATE;

  DELETE FROM sheet_interests WHERE sheet_id = p_sheet_id;
  UPDATE sheets SET interest_count = 0 WHERE id = p_sheet_id;
END;
$$;

-- Restrict execution to service_role (used by backend)
REVOKE EXECUTE ON FUNCTION reset_sheet_interest(bigint) FROM public;
GRANT EXECUTE ON FUNCTION reset_sheet_interest(bigint) TO service_role;

-- 4. RPC: toggle_sheet_interest (atomic toggle for public API)
--    Returns JSON: { "interested": bool, "interest_count": int }
CREATE OR REPLACE FUNCTION toggle_sheet_interest(
  p_sheet_id bigint,
  p_device_id uuid,
  p_ip_hash text
)
RETURNS json
LANGUAGE plpgsql
AS $$
DECLARE
  is_interested boolean;
  new_count int;
BEGIN
  -- Try to insert; if unique violation → already interested, so toggle off
  BEGIN
    INSERT INTO sheet_interests (sheet_id, device_id, ip_hash)
    VALUES (p_sheet_id, p_device_id, p_ip_hash);
    is_interested := true;
  EXCEPTION WHEN unique_violation THEN
    DELETE FROM sheet_interests
    WHERE sheet_id = p_sheet_id AND device_id = p_device_id;
    is_interested := false;
  END;

  -- The trigger has already updated interest_count, just read it
  SELECT interest_count INTO new_count FROM sheets WHERE id = p_sheet_id;

  RETURN json_build_object(
    'interested', is_interested,
    'interest_count', COALESCE(new_count, 0)
  );
END;
$$;

-- Restrict execution to service_role (used by backend)
REVOKE EXECUTE ON FUNCTION toggle_sheet_interest(bigint, uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION toggle_sheet_interest(bigint, uuid, text) TO service_role;
