-- =============================================================
-- Baciraro Admin Panel -- Modul Inventori: Titipan (Consignment)
-- Fitur: Master toko, nota titip keluar, pelaporan terjual /
--        retur / susut di toko, rekap sisa titipan.
-- Jalankan di Supabase SQL Editor SETELAH supabase-inventori.sql,
-- supabase-inventori-bahan-baku.sql, supabase-inventori-desimal.sql
-- dan supabase-no-hard-delete.sql.
--
-- Logika stok:
--   * Titip keluar  -> inventory_items.stok KURANG (reason 'titip')
--   * Terjual       -> tanpa mutasi stok (sudah keluar saat titip)
--   * Retur         -> inventory_items.stok NAIK  (reason 'retur_titip')
--   * Susut         -> tanpa mutasi stok (murni catatan)
-- Sisa di toko = Σ dititip − Σ (terjual + retur + susut) per item.
-- Sengaja TANPA jurnal double-entry & tanpa baris kas.
-- =============================================================

-- ============================================================
-- 1. tokos (Master toko tempat barang dititipkan)
-- ============================================================
CREATE TABLE IF NOT EXISTS tokos (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  contact_name TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  address TEXT DEFAULT '',
  city TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by BIGINT REFERENCES team_members(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS tokos_name_key ON tokos (lower(name));
CREATE INDEX IF NOT EXISTS idx_tokos_active ON tokos(is_active);

-- ============================================================
-- 2. consignments (Nota titip — 1 baris = 1 pengiriman ke 1 toko)
-- ============================================================
CREATE TABLE IF NOT EXISTS consignments (
  id BIGSERIAL PRIMARY KEY,
  reference TEXT NOT NULL UNIQUE,
  toko_id BIGINT NOT NULL REFERENCES tokos(id) ON DELETE RESTRICT,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  note TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','void')),
  void_reason TEXT DEFAULT '',
  created_by BIGINT REFERENCES team_members(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_consignments_toko ON consignments(toko_id);
CREATE INDEX IF NOT EXISTS idx_consignments_date ON consignments(date DESC);
CREATE INDEX IF NOT EXISTS idx_consignments_ref ON consignments(reference);

-- ============================================================
-- 3. consignment_items (Barang per nota titip, dengan snapshot harga)
-- ============================================================
CREATE TABLE IF NOT EXISTS consignment_items (
  id BIGSERIAL PRIMARY KEY,
  consignment_id BIGINT NOT NULL REFERENCES consignments(id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL REFERENCES inventory_items(id) ON DELETE RESTRICT,
  qty NUMERIC(14,3) NOT NULL CHECK (qty > 0),
  harga_jual NUMERIC(14,2) NOT NULL DEFAULT 0,
  harga_modal NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_consignment_items_note ON consignment_items(consignment_id);
CREATE INDEX IF NOT EXISTS idx_consignment_items_product ON consignment_items(product_id);

-- ============================================================
-- 4. consignment_events (Pelaporan dari toko: terjual / retur / susut)
-- ============================================================
CREATE TABLE IF NOT EXISTS consignment_events (
  id BIGSERIAL PRIMARY KEY,
  consignment_item_id BIGINT NOT NULL REFERENCES consignment_items(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('terjual','retur','susut')),
  qty NUMERIC(14,3) NOT NULL CHECK (qty > 0),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  note TEXT DEFAULT '',
  stock_movement_id BIGINT REFERENCES stock_movements(id) ON DELETE SET NULL,
  created_by BIGINT REFERENCES team_members(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_consignment_events_item ON consignment_events(consignment_item_id);
CREATE INDEX IF NOT EXISTS idx_consignment_events_type ON consignment_events(type);

-- ============================================================
-- 5. stock_movements: tautan ke nota titip + dua alasan baru
--    'titip'      = barang keluar ke toko (type 'out')
--    'retur_titip' = barang kembali dari toko (type 'in')
--    Keduanya agar alur titipan otomatis tampil di kartu stok
--    dan tab Mutasi tanpa perubahan UI di sana.
-- ============================================================
ALTER TABLE stock_movements
  ADD COLUMN IF NOT EXISTS consignment_id BIGINT REFERENCES consignments(id) ON DELETE SET NULL;

DO $$
DECLARE c RECORD;
BEGIN
  FOR c IN SELECT con.conname FROM pg_constraint con
           JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = ANY (con.conkey)
           WHERE con.conrelid = 'stock_movements'::regclass AND con.contype = 'c' AND att.attname = 'reason'
  LOOP EXECUTE format('ALTER TABLE stock_movements DROP CONSTRAINT %I', c.conname); END LOOP;
  ALTER TABLE stock_movements ADD CONSTRAINT stock_movements_reason_check
    CHECK (reason IN ('stok_awal', 'penyesuaian', 'terjual', 'gratis', 'rusak', 'hilang', 'koreksi', 'titip', 'retur_titip'));
END $$;

-- ============================================================
-- 6. Sequence reset (amannya dijalankan terakhir)
-- ============================================================
SELECT setval('tokos_id_seq', COALESCE((SELECT MAX(id) FROM tokos), 1));
SELECT setval('consignments_id_seq', COALESCE((SELECT MAX(id) FROM consignments), 1));
SELECT setval('consignment_items_id_seq', COALESCE((SELECT MAX(id) FROM consignment_items), 1));
SELECT setval('consignment_events_id_seq', COALESCE((SELECT MAX(id) FROM consignment_events), 1));
