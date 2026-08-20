-- =============================================================
-- Baciraro Admin Panel — Migrasi v3 (incremental, TANPA DROP DATA)
-- Fitur: kontributor eksternal (di luar team_members) + nominal
-- opsional per kontributor project.
--
-- Jalankan di Supabase SQL Editor setelah v2.
-- =============================================================

-- 1) Kontributor eksternal: member_id boleh NULL
ALTER TABLE project_members ALTER COLUMN member_id DROP NOT NULL;

-- 2) Nama kontributor tersimpan (untuk eksternal; anggota ikut disnapshot)
ALTER TABLE project_members ADD COLUMN IF NOT EXISTS name TEXT;

-- 3) Nominal opsional per kontributor (info saja; bagi hasil tetap berdasar persen)
ALTER TABLE project_members ADD COLUMN IF NOT EXISTS amount NUMERIC(14,2);

-- 4) Backfill nama untuk data lama dari team_members
UPDATE project_members pm
SET name = tm.name
FROM team_members tm
WHERE pm.member_id = tm.id
  AND pm.name IS NULL;

-- 5) Jaga konsistensi: baris eksternal wajib punya nama
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'project_members_name_or_member_check'
  ) THEN
    ALTER TABLE project_members
      ADD CONSTRAINT project_members_name_or_member_check
      CHECK (
        member_id IS NOT NULL OR
        (name IS NOT NULL AND length(btrim(name)) > 0)
      );
  END IF;
END $$;