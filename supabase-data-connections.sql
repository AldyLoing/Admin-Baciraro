-- =============================================================
-- Baciraro Admin Panel -- Data Connection Upgrades
-- Fitur: account_code di transactions, financial views
-- Jalankan di Supabase SQL Editor setelah double-entry migration.
-- ============================================================

-- ============================================================
-- 1. Tambah kolom account_code ke transactions
-- ============================================================
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS account_code INTEGER;

-- ============================================================
-- 2. Update account_code berdasarkan type transaksi yang ada
--    income -> 4101 (Pendapatan)
--    expense -> 5119 (Beban Lainnya) sebagai default
-- ============================================================
UPDATE transactions SET account_code = 4101 WHERE type = 'income' AND account_code IS NULL;
UPDATE transactions SET account_code = 5119 WHERE type = 'expense' AND account_code IS NULL;

-- ============================================================
-- 3. Tambah kolom estimated_cost dan actual_cost ke tasks
-- ============================================================
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS estimated_cost NUMERIC(14,2) DEFAULT 0;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS actual_cost NUMERIC(14,2) DEFAULT 0;
