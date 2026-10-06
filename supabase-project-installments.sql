-- Fitur Cicilan Project: klien bayar bertahap → sisa tagihan otomatis,
-- pembagian (payout) ke tim per cicilan, auto-lunas saat sisa 0.
-- TABEL BARU SAJA — tidak ada tabel/kolom lama yang diubah atau dihapus.
-- Jalankan di SUPABASE SQL EDITOR. Idempoten — boleh dijalankan ulang.

CREATE TABLE IF NOT EXISTS project_installments (
  id BIGSERIAL PRIMARY KEY,
  project_id BIGINT NOT NULL REFERENCES projects(id),
  installment_no INTEGER NOT NULL,
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'void')),
  transaction_id BIGINT REFERENCES transactions(id),
  payout_id BIGINT REFERENCES payouts(id),
  created_by BIGINT REFERENCES team_members(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (project_id, installment_no)
);

CREATE INDEX IF NOT EXISTS idx_project_installments_project
  ON project_installments(project_id);

-- Satu cicilan hanya boleh terhubung ke satu payout (dijaga aplikasi +
-- index ini sebagai pengaman terakhir bila ada race condition).
CREATE UNIQUE INDEX IF NOT EXISTS uniq_project_installments_payout
  ON project_installments(payout_id) WHERE payout_id IS NOT NULL;
