-- Migración 2
-- Add indices for image rebuilding and filtering
CREATE INDEX IF NOT EXISTS ix_sheets_exam_storage_path ON sheets (exam_storage_path);
CREATE INDEX IF NOT EXISTS ix_sheets_thumb_storage_path ON sheets (thumb_storage_path);
