-- RF-04: Tabla para registrar interés en solucionarios
-- Un usuario (device_id) puede registrar interés una vez por plancha
-- Note: All INSERT/DELETE operations go through supabaseAdmin (service role),
-- which bypasses RLS. Policies below are for completeness.

CREATE TABLE IF NOT EXISTS sheet_interests (
  id bigserial PRIMARY KEY,
  sheet_id bigint NOT NULL REFERENCES sheets(id) ON DELETE CASCADE,
  device_id uuid NOT NULL,
  ip_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sheet_id, device_id)
);

-- Índice para consultas por sheet_id
CREATE INDEX IF NOT EXISTS idx_sheet_interests_sheet_id
  ON sheet_interests (sheet_id);

-- RLS con policies
-- Note: Solo supabaseAdmin interactuará con esta tabla (service_role bypasses RLS)
ALTER TABLE sheet_interests ENABLE ROW LEVEL SECURITY;

-- Columna interest_count en sheets (similar a view_count y rating_count)
ALTER TABLE sheets ADD COLUMN IF NOT EXISTS interest_count bigint DEFAULT 0;
