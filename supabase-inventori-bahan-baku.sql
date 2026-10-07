-- Fitur Bahan Baku (inventori): bahan baku punya stok & mutasi sendiri,
-- tampil di tab "Bahan Baku", TIDAK muncul di dropdown penjualan.
-- Jalankan DI SUPABASE SQL EDITOR. Idempoten — boleh dijalankan ulang.

ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS is_raw_material BOOLEAN NOT NULL DEFAULT FALSE;

-- Tanda default kategori agar konsisten (hanya untuk baris yang kosong).
UPDATE inventory_items SET category = 'Bahan Baku' WHERE is_raw_material AND category = '';
