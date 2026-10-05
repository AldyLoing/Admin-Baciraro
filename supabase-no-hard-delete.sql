-- Nol Hard Delete: semua "hapus" jadi non-destruktif (void / nonaktif / arsip).
-- Jalankan DI SUPABASE SQL EDITOR (project hostinganteamorders). Idempoten — boleh dijalankan ulang.
-- Setelah ini, tidak ada route aplikasi yang memanggil .delete() lagi.

-- ============================================================
-- 1. Kolom status baru (batal/arsip)
-- ============================================================
ALTER TABLE transactions    ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE sales           ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE meeting_notes   ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE qr_codes        ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ;
ALTER TABLE project_members ADD COLUMN IF NOT EXISTS removed_at TIMESTAMPTZ;
ALTER TABLE project_templates ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE notifications   ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT false;

-- ============================================================
-- 2. CHECK constraints — ganti dengan versi yang memuat nilai baru
--    (cari nama constraint via pg_constraint agar tahan rename/ulang)
-- ============================================================
DO $$
DECLARE c RECORD;
BEGIN
  -- transactions.status
  FOR c IN SELECT con.conname FROM pg_constraint con
           JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = ANY (con.conkey)
           WHERE con.conrelid = 'transactions'::regclass AND con.contype = 'c' AND att.attname = 'status'
  LOOP EXECUTE format('ALTER TABLE transactions DROP CONSTRAINT %I', c.conname); END LOOP;
  ALTER TABLE transactions ADD CONSTRAINT transactions_status_check
    CHECK (status IN ('active', 'void'));

  -- journal_entries.status
  FOR c IN SELECT con.conname FROM pg_constraint con
           JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = ANY (con.conkey)
           WHERE con.conrelid = 'journal_entries'::regclass AND con.contype = 'c' AND att.attname = 'status'
  LOOP EXECUTE format('ALTER TABLE journal_entries DROP CONSTRAINT %I', c.conname); END LOOP;
  ALTER TABLE journal_entries ADD CONSTRAINT journal_entries_status_check
    CHECK (status IN ('active', 'void'));

  -- sales.status
  FOR c IN SELECT con.conname FROM pg_constraint con
           JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = ANY (con.conkey)
           WHERE con.conrelid = 'sales'::regclass AND con.contype = 'c' AND att.attname = 'status'
  LOOP EXECUTE format('ALTER TABLE sales DROP CONSTRAINT %I', c.conname); END LOOP;
  ALTER TABLE sales ADD CONSTRAINT sales_status_check
    CHECK (status IN ('active', 'void'));

  -- meeting_notes.status
  FOR c IN SELECT con.conname FROM pg_constraint con
           JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = ANY (con.conkey)
           WHERE con.conrelid = 'meeting_notes'::regclass AND con.contype = 'c' AND att.attname = 'status'
  LOOP EXECUTE format('ALTER TABLE meeting_notes DROP CONSTRAINT %I', c.conname); END LOOP;
  ALTER TABLE meeting_notes ADD CONSTRAINT meeting_notes_status_check
    CHECK (status IN ('active', 'archived'));

  -- tasks.status + 'cancelled'
  FOR c IN SELECT con.conname FROM pg_constraint con
           JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = ANY (con.conkey)
           WHERE con.conrelid = 'tasks'::regclass AND con.contype = 'c' AND att.attname = 'status'
  LOOP EXECUTE format('ALTER TABLE tasks DROP CONSTRAINT %I', c.conname); END LOOP;
  ALTER TABLE tasks ADD CONSTRAINT tasks_status_check
    CHECK (status IN ('pending', 'active', 'completed', 'cancelled'));

  -- payouts.status + 'cancelled'
  FOR c IN SELECT con.conname FROM pg_constraint con
           JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = ANY (con.conkey)
           WHERE con.conrelid = 'payouts'::regclass AND con.contype = 'c' AND att.attname = 'status'
  LOOP EXECUTE format('ALTER TABLE payouts DROP CONSTRAINT %I', c.conname); END LOOP;
  ALTER TABLE payouts ADD CONSTRAINT payouts_status_check
    CHECK (status IN ('pending', 'processing', 'paid', 'cancelled'));

  -- action_items.status + 'removed'
  FOR c IN SELECT con.conname FROM pg_constraint con
           JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = ANY (con.conkey)
           WHERE con.conrelid = 'action_items'::regclass AND con.contype = 'c' AND att.attname = 'status'
  LOOP EXECUTE format('ALTER TABLE action_items DROP CONSTRAINT %I', c.conname); END LOOP;
  ALTER TABLE action_items ADD CONSTRAINT action_items_status_check
    CHECK (status IN ('pending', 'completed', 'removed'));

  -- stock_movements.reason + 'koreksi' (mutasi kompensasi, bukan penghapusan)
  FOR c IN SELECT con.conname FROM pg_constraint con
           JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = ANY (con.conkey)
           WHERE con.conrelid = 'stock_movements'::regclass AND con.contype = 'c' AND att.attname = 'reason'
  LOOP EXECUTE format('ALTER TABLE stock_movements DROP CONSTRAINT %I', c.conname); END LOOP;
  ALTER TABLE stock_movements ADD CONSTRAINT stock_movements_reason_check
    CHECK (reason IN ('stok_awal', 'penyesuaian', 'terjual', 'gratis', 'rusak', 'hilang', 'koreksi'));
END $$;

-- ============================================================
-- 3. Reuse referensi: email wajib unik (sudah diverifikasi 0 duplikat;
--    NULL diperbolehkan berkali-kali oleh UNIQUE Postgres)
-- ============================================================
DO $$
BEGIN
  ALTER TABLE team_members ADD CONSTRAINT team_members_email_key UNIQUE (email);
EXCEPTION
  WHEN duplicate_table THEN NULL;          -- sudah ada
  WHEN duplicate_object THEN NULL;         -- sudah ada
END $$;

-- ============================================================
-- 4. Index untuk query filter status aktif
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_transactions_status    ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_journal_entries_status ON journal_entries(status);
CREATE INDEX IF NOT EXISTS idx_sales_status           ON sales(status);
CREATE INDEX IF NOT EXISTS idx_meeting_notes_status   ON meeting_notes(status);
