-- =============================================================
-- Baciraro Admin Panel — Bagi Hasil Penjualan
-- Fitur: setiap penjualan (SL-) bisa dibagi hasilkan ke anggota
-- dengan aturan yang sama seperti payout project
-- (fee Kas Baciraro KAS_PERCENT 10% dipotong dulu, sisanya dibagi
-- sesuai persen kontribusi yang diisi di form).
--
-- Jalankan di Supabase SQL Editor SETELAH supabase-titipan.sql
-- (dan seluruh migrasi sebelumnya). Idempoten — boleh dijalankan ulang.
-- =============================================================

-- 1. Link payout ke penjualan (nullable — payout project tetap project_id)
ALTER TABLE payouts ADD COLUMN IF NOT EXISTS sale_id BIGINT REFERENCES sales(id) ON DELETE SET NULL;

-- 2. Sumber payout: 'project' (lama) atau 'penjualan' (baru)
ALTER TABLE payouts ADD COLUMN IF NOT EXISTS source_type TEXT NOT NULL DEFAULT 'project';
DO $$
DECLARE c RECORD;
BEGIN
  FOR c IN SELECT con.conname FROM pg_constraint con
           JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = ANY (con.conkey)
           WHERE con.conrelid = 'payouts'::regclass AND con.contype = 'c' AND att.attname = 'source_type'
  LOOP EXECUTE format('ALTER TABLE payouts DROP CONSTRAINT %I', c.conname); END LOOP;
  ALTER TABLE payouts ADD CONSTRAINT payouts_source_type_check
    CHECK (source_type IN ('project', 'penjualan'));
END $$;

-- 3. Satu payout AKTIF per penjualan (pembatalan boleh dibuat ulang)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_payouts_active_sale
  ON payouts (sale_id)
  WHERE sale_id IS NOT NULL AND status <> 'cancelled';

-- 4. Index untuk embed/lookup dari sisi sales
CREATE INDEX IF NOT EXISTS idx_payouts_sale_id ON payouts (sale_id) WHERE sale_id IS NOT NULL;
