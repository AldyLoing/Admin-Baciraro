-- Desimal stok: mendukung bahan berat (kg) & pecahan satuan lain.
-- Kolom stok/qty berubah INT -> NUMERIC(14,3); data lama ikut terkonversi tanpa kehilangan.
-- Jalankan DI SUPABASE SQL EDITOR. Idempoten — boleh dijalankan ulang.

ALTER TABLE inventory_items ALTER COLUMN stok     TYPE NUMERIC(14,3);
ALTER TABLE inventory_items ALTER COLUMN stok_min TYPE NUMERIC(14,3);
ALTER TABLE stock_movements ALTER COLUMN qty      TYPE NUMERIC(14,3);
ALTER TABLE sale_items      ALTER COLUMN qty      TYPE NUMERIC(14,3);
