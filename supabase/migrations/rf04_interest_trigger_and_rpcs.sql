-- ============================================================
-- RF-03/RF-04: Interest count trigger + atomic RPCs
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- 1. Trigger function: auto-update sheets.interest_count
--    after INSERT or DELETE on sheet_interests
CREATE OR REPLACE FUNCTION update_sheet_interest_count()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  target_sheet_id bigint;
BEGIN
  -- Determine which sheet_id was affected
  IF TG_OP = 'DELETE' THEN
    target_sheet_id := OLD.sheet_id;
  ELSE
    target_sheet_id := NEW.sheet_id;
  END IF;

  UPDATE sheets
  SET interest_count = (
    SELECT count(*) FROM sheet_interests WHERE sheet_id = target_sheet_id
  )
  WHERE id = target_sheet_id;

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
CREATE OR REPLACE FUNCTION reset_sheet_interest(p_sheet_id bigint)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM sheet_interests WHERE sheet_id = p_sheet_id;
  UPDATE sheets SET interest_count = 0 WHERE id = p_sheet_id;
END;
$$;

-- 4. RPC: toggle_sheet_interest (atomic toggle for public API)
--    Returns JSON: { "interested": bool, "interest_count": int }
CREATE OR REPLACE FUNCTION toggle_sheet_interest(
  p_sheet_id bigint,
  p_device_id text,
  p_ip_hash text
)
RETURNS json
LANGUAGE plpgsql
AS $$
DECLARE
  existing_id bigint;
  is_interested boolean;
  new_count int;
BEGIN
  -- Check if already interested
  SELECT id INTO existing_id
  FROM sheet_interests
  WHERE sheet_id = p_sheet_id AND device_id = p_device_id;

  IF existing_id IS NOT NULL THEN
    -- Remove interest (toggle off)
    DELETE FROM sheet_interests WHERE id = existing_id;
    is_interested := false;
  ELSE
    -- Add interest (toggle on)
    INSERT INTO sheet_interests (sheet_id, device_id, ip_hash)
    VALUES (p_sheet_id, p_device_id, p_ip_hash);
    is_interested := true;
  END IF;

  -- The trigger has already updated interest_count, just read it
  SELECT interest_count INTO new_count FROM sheets WHERE id = p_sheet_id;

  RETURN json_build_object(
    'interested', is_interested,
    'interest_count', COALESCE(new_count, 0)
  );
END;
$$;
