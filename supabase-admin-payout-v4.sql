-- =============================================================
-- Baciraro Admin Panel — Migrasi v4 (incremental, TANPA DROP DATA)
-- Fitur: tugas per kontributor + nominal payout menyusul
-- (uang riil diisi belakangan, persen dikunci dari awal).
--
-- Jalankan di Supabase SQL Editor setelah v3.
-- =============================================================

-- 1) Tugas (apa yang dikerjakan) per kontributor project
ALTER TABLE project_members ADD COLUMN IF NOT EXISTS tugas TEXT;

-- 2) Tugas di-snapshot ke rincian payout saat bagi hasil dibuat
ALTER TABLE payout_members ADD COLUMN IF NOT EXISTS tugas TEXT;

-- 3) Penanda nominal riil payout sudah diisi (total_amount/orders_fee/net_amount
--    dan amount per member dihitung dari total riil)
ALTER TABLE payouts ADD COLUMN IF NOT EXISTS finalized_at TIMESTAMPTZ;