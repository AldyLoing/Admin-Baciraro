-- =============================================================
-- Baciraro Admin Panel -- Double-Entry Bookkeeping Migration
-- Fitur: Chart of Accounts, Jurnal Umum (Debit/Kredit), Buku Besar
-- Jalankan di Supabase SQL Editor setelah migration sebelumnya.
-- =============================================================

-- ============================================================
-- 1. accounts (Chart of Accounts / Daftar Akun)
-- ============================================================
CREATE TABLE IF NOT EXISTS accounts (
  id BIGSERIAL PRIMARY KEY,
  code INTEGER NOT NULL UNIQUE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('asset', 'liability', 'equity', 'revenue', 'expense')),
  parent_code INTEGER,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 2. journal_entries (Jurnal Umum - header)
-- ============================================================
CREATE TABLE IF NOT EXISTS journal_entries (
  id BIGSERIAL PRIMARY KEY,
  date DATE NOT NULL,
  description TEXT NOT NULL,
  reference TEXT DEFAULT '',
  transaction_id BIGINT REFERENCES transactions(id) ON DELETE SET NULL,
  total_debit NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_credit NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_by BIGINT REFERENCES team_members(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_journal_entries_date ON journal_entries(date DESC);
CREATE INDEX IF NOT EXISTS idx_journal_entries_ref ON journal_entries(reference);
CREATE INDEX IF NOT EXISTS idx_journal_entries_transaction ON journal_entries(transaction_id);

-- ============================================================
-- 3. journal_entry_lines (Detail baris jurnal)
-- ============================================================
CREATE TABLE IF NOT EXISTS journal_entry_lines (
  id BIGSERIAL PRIMARY KEY,
  journal_entry_id BIGINT NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  account_code INTEGER NOT NULL REFERENCES accounts(code),
  debit NUMERIC(14,2) NOT NULL DEFAULT 0,
  credit NUMERIC(14,2) NOT NULL DEFAULT 0,
  description TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_journal_lines_entry ON journal_entry_lines(journal_entry_id);
CREATE INDEX IF NOT EXISTS idx_journal_lines_account ON journal_entry_lines(account_code);

-- ============================================================
-- 4. Seed Chart of Accounts (dari Excel Jurnal Transaksi 2026)
-- ============================================================
INSERT INTO accounts (code, name, type) VALUES
  (1101, 'Kas di bank - SEABANK', 'asset'),
  (1102, 'Kas di bank - SEABANK', 'asset'),
  (4101, 'Pendapatan', 'revenue'),
  (5101, 'Pembagian Pendapatan', 'expense'),
  (5102, 'Beban Jasa 3D', 'expense'),
  (5103, 'Beban Penjemputan DBS', 'expense'),
  (5104, 'Beban Konsumsi', 'expense'),
  (5105, 'Beban Pengolahan Nutrifood', 'expense'),
  (5119, 'Beban Lainnya', 'expense')
ON CONFLICT (code) DO NOTHING;

-- ============================================================
-- 5. Constraint: total debit harus sama dengan total credit
-- ============================================================
-- Note: enforced via application logic (API) rather than DB constraint
-- because journal_entries stores pre-computed totals for performance.
