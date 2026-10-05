-- =============================================================
-- Baciraro Admin Panel -- Modul Inventori Barang
-- Fitur: Master barang, mutasi stok masuk/keluar, penjualan,
--        kas & jurnal double-entry otomatis.
-- Jalankan di Supabase SQL Editor setelah migration sebelumnya.
-- =============================================================

-- ============================================================
-- 1. inventory_items (Master barang: ganci, asbak, coaster, dll.)
-- ============================================================
CREATE TABLE IF NOT EXISTS inventory_items (
  id BIGSERIAL PRIMARY KEY,
  sku TEXT UNIQUE,
  name TEXT NOT NULL,
  category TEXT DEFAULT '',
  unit TEXT DEFAULT 'pcs',
  harga_modal NUMERIC(14,2) NOT NULL DEFAULT 0,
  harga_jual NUMERIC(14,2) NOT NULL DEFAULT 0,
  stok INT NOT NULL DEFAULT 0,
  stok_min INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_items_name ON inventory_items(name);
CREATE INDEX IF NOT EXISTS idx_inventory_items_sku ON inventory_items(sku);

-- ============================================================
-- 2. sales (Header penjualan — satu baris kas & jurnal)
-- ============================================================
CREATE TABLE IF NOT EXISTS sales (
  id BIGSERIAL PRIMARY KEY,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  reference TEXT NOT NULL DEFAULT '',
  recipient TEXT DEFAULT '',
  total NUMERIC(14,2) NOT NULL DEFAULT 0,
  payment_note TEXT DEFAULT '',
  transaction_id BIGINT REFERENCES transactions(id) ON DELETE SET NULL,
  journal_entry_id BIGINT REFERENCES journal_entries(id) ON DELETE SET NULL,
  created_by BIGINT REFERENCES team_members(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(date DESC);
CREATE INDEX IF NOT EXISTS idx_sales_ref ON sales(reference);
CREATE INDEX IF NOT EXISTS idx_sales_recipient ON sales(recipient);

-- ============================================================
-- 3. sale_items (Isi penjualan — multi item)
-- ============================================================
CREATE TABLE IF NOT EXISTS sale_items (
  id BIGSERIAL PRIMARY KEY,
  sale_id BIGINT NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL REFERENCES inventory_items(id) ON DELETE RESTRICT,
  qty INT NOT NULL CHECK (qty > 0),
  harga_jual NUMERIC(14,2) NOT NULL DEFAULT 0,
  harga_modal NUMERIC(14,2) NOT NULL DEFAULT 0,
  subtotal NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_product ON sale_items(product_id);

-- ============================================================
-- 4. stock_movements (Semua mutasi masuk/keluar barang)
-- ============================================================
CREATE TABLE IF NOT EXISTS stock_movements (
  id BIGSERIAL PRIMARY KEY,
  product_id BIGINT NOT NULL REFERENCES inventory_items(id) ON DELETE RESTRICT,
  type TEXT NOT NULL CHECK (type IN ('in','out')),
  reason TEXT NOT NULL CHECK (reason IN ('stok_awal','penyesuaian','terjual','gratis','rusak','hilang')),
  qty INT NOT NULL CHECK (qty > 0),
  recipient TEXT DEFAULT '',
  note TEXT DEFAULT '',
  reference TEXT DEFAULT '',
  harga_modal NUMERIC(14,2) NOT NULL DEFAULT 0,
  sale_id BIGINT REFERENCES sales(id) ON DELETE SET NULL,
  transaction_id BIGINT REFERENCES transactions(id) ON DELETE SET NULL,
  journal_entry_id BIGINT REFERENCES journal_entries(id) ON DELETE SET NULL,
  created_by BIGINT REFERENCES team_members(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_movements_product ON stock_movements(product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_movements_date ON stock_movements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_movements_type ON stock_movements(type);
CREATE INDEX IF NOT EXISTS idx_movements_reason ON stock_movements(reason);

-- ============================================================
-- 5. Seed akun baru (Chart of Accounts)
--    Catatan: 4102 & 5106 sudah dipakai akun lain
--    (Pendapatan Lainnya, Beban Transportasi), jadi modul
--    inventori memakai 4103 (Selisih Opname) & 5108 (HPP).
-- ============================================================
INSERT INTO accounts (code, name, type) VALUES
  (1103, 'Persediaan Barang', 'asset'),
  (4103, 'Selisih Opname Persediaan', 'revenue'),
  (5108, 'Harga Pokok Penjualan', 'expense'),
  (5120, 'Beban Promosi Barang', 'expense'),
  (5121, 'Beban Selisih Opname Persediaan', 'expense')
ON CONFLICT (code) DO NOTHING;
