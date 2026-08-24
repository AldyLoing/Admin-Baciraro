-- Migrasi: QR Koin Event (voucher sekali pakai)
-- Jalankan manual di Supabase SQL Editor.

alter table qr_codes
  add column if not exists is_event boolean not null default false;

alter table qr_codes
  add column if not exists event_name text;

alter table qr_codes
  add column if not exists event_points int not null default 10;

-- Indeks ringan untuk query admin
create index if not exists idx_qr_codes_is_event on qr_codes (is_event);
