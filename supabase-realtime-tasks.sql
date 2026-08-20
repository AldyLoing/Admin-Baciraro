-- =============================================================
-- Baciraro Admin — Realtime Jadwal & Tugas + sinkron Google Calendar
--
-- Jalankan di Supabase SQL Editor.
--
-- CATATAN keamanan: panel admin memakai JWT custom (cookie), BUKAN
-- Supabase Auth. Karena itu subscribe Realtime dari browser memakai
-- publishable key = role anon. Untuk mengizinkannya, RLS dibuka untuk
-- SELECT publik pada tabel tasks. Konsekuensi: jadwal/tugas bisa dibaca
-- oleh siapa pun yang punya publishable key. Diterima oleh pemilik.
-- =============================================================

-- 1) Kolom penyimpan event id Google Calendar untuk tugas.
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS gcal_event_id TEXT;

-- 2) Izinkan realtime (postgres_changes) pada tabel tasks.
--    Guard: jangan error jika tasks sudah jadi member publication.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'tasks'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE tasks;
  END IF;
END $$;

-- 3) RLS + policy SELECT anon agar subscription Realtime berfungsi
--    dari browser client (publishable key).
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon read tasks" ON tasks;
CREATE POLICY "anon read tasks" ON tasks FOR SELECT USING (true);