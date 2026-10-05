-- Audit trail immutable: activity_log tidak bisa diubah/dihapus.
-- Jalankan di Supabase SQL Editor (project hostinganteamorders).
-- Berlaku untuk semua jalur: aplikasi, REST (service key), maupun SQL editor biasa.

CREATE OR REPLACE FUNCTION block_audit_mutation() RETURNS trigger AS $$
BEGIN
  -- Satu-satunya perubahan yang diizinkan: user_id -> NULL (efek ON DELETE SET NULL
  -- saat baris team_members dihapus). Identitas aktor tetap tersimpan di user_name.
  IF TG_OP = 'UPDATE'
     AND NEW.id = OLD.id
     AND NEW.user_id IS NULL AND OLD.user_id IS NOT NULL
     AND NEW.user_name IS NOT DISTINCT FROM OLD.user_name
     AND NEW.action IS NOT DISTINCT FROM OLD.action
     AND NEW.entity_type IS NOT DISTINCT FROM OLD.entity_type
     AND NEW.entity_id IS NOT DISTINCT FROM OLD.entity_id
     AND NEW.entity_name IS NOT DISTINCT FROM OLD.entity_name
     AND NEW.details IS NOT DISTINCT FROM OLD.details
     AND NEW.created_at IS NOT DISTINCT FROM OLD.created_at
  THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'activity_log adalah audit trail permanen: % ditolak', TG_OP;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_protect_activity_log ON activity_log;
CREATE TRIGGER trg_protect_activity_log
  BEFORE UPDATE OR DELETE ON activity_log
  FOR EACH ROW EXECUTE FUNCTION block_audit_mutation();

CREATE INDEX IF NOT EXISTS idx_activity_log_user ON activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_action ON activity_log(action);
