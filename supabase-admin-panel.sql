-- Baciraro Admin Panel Migration v2
-- Run this in Supabase SQL Editor.
-- Anggota = team_members (data /leadership). team_members kini juga tabel auth
-- (username/password/is_admin/status). users tidak dipakai panel admin lagi.

-- ============================================================
-- 0. Drop versi lama tabel admin (belum ada data produksi)
--    PERINGATAN: data pada tabel di bawah ini akan HAPUS.
-- ============================================================
DROP TABLE IF EXISTS action_items CASCADE;
DROP TABLE IF EXISTS meeting_note_attendees CASCADE;
DROP TABLE IF EXISTS meeting_notes CASCADE;
DROP TABLE IF EXISTS tasks CASCADE;
DROP TABLE IF EXISTS payout_members CASCADE;
DROP TABLE IF EXISTS payouts CASCADE;
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS project_members CASCADE;
DROP TABLE IF EXISTS projects CASCADE;

-- ============================================================
-- 1. team_members = anggota + auth
-- ============================================================
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS username TEXT UNIQUE;
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS password TEXT;
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

-- Copy akun admin dari users (pertahankan hash password) jika ada.
INSERT INTO team_members (name, role, division, username, password, is_admin, status, email)
SELECT name, 'Founder', 'founder', username, password, TRUE, 'active', username
FROM users
WHERE username = 'baciraro@gmail.com'
ON CONFLICT (username) DO NOTHING;

-- Pastikan akun admin selalu aktif & admin.
UPDATE team_members SET is_admin = TRUE, status = 'active', role = 'Founder'
WHERE username = 'baciraro@gmail.com';

-- 2. projects
CREATE TABLE IF NOT EXISTS projects (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  client_name TEXT,
  description TEXT,
  total_value NUMERIC(14,2) DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- 3. project_members (kontributor opsional per project; member_id NULL = eksternal)
CREATE TABLE IF NOT EXISTS project_members (
  id BIGSERIAL PRIMARY KEY,
  project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  member_id BIGINT REFERENCES team_members(id) ON DELETE SET NULL,
  name TEXT,
  contribution_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
  amount NUMERIC(14,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (project_id, member_id),
  CONSTRAINT project_members_name_or_member_check CHECK (
    member_id IS NOT NULL OR (name IS NOT NULL AND length(btrim(name)) > 0)
  )
);

-- 4. transactions (buku kas)
CREATE TABLE IF NOT EXISTS transactions (
  id BIGSERIAL PRIMARY KEY,
  date DATE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT '',
  description TEXT DEFAULT '',
  reference TEXT DEFAULT '',
  project_id BIGINT REFERENCES projects(id) ON DELETE SET NULL,
  created_by BIGINT REFERENCES team_members(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. payouts
CREATE TABLE IF NOT EXISTS payouts (
  id BIGSERIAL PRIMARY KEY,
  project_id BIGINT REFERENCES projects(id) ON DELETE SET NULL,
  project_name TEXT NOT NULL,
  date DATE NOT NULL,
  total_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  orders_fee NUMERIC(14,2) NOT NULL DEFAULT 0,
  net_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'paid')),
  created_by BIGINT REFERENCES team_members(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. payout_members
CREATE TABLE IF NOT EXISTS payout_members (
  id BIGSERIAL PRIMARY KEY,
  payout_id BIGINT NOT NULL REFERENCES payouts(id) ON DELETE CASCADE,
  member_id BIGINT REFERENCES team_members(id) ON DELETE SET NULL,
  name TEXT NOT NULL DEFAULT '',
  contribution_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
  amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. tasks (jadwal & tugas — sinkron via embed/ICS/template)
CREATE TABLE IF NOT EXISTS tasks (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  project_id BIGINT REFERENCES projects(id) ON DELETE CASCADE,
  assigned_to BIGINT REFERENCES team_members(id) ON DELETE SET NULL,
  due_date DATE,
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'completed')),
  ics_uid TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tasks_ics_uid ON tasks (ics_uid);

-- 8. meeting_notes
CREATE TABLE IF NOT EXISTS meeting_notes (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  date DATE NOT NULL,
  agenda TEXT,
  notes TEXT,
  project_id BIGINT REFERENCES projects(id) ON DELETE SET NULL,
  created_by BIGINT REFERENCES team_members(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. meeting_note_attendees
CREATE TABLE IF NOT EXISTS meeting_note_attendees (
  id BIGSERIAL PRIMARY KEY,
  meeting_note_id BIGINT NOT NULL REFERENCES meeting_notes(id) ON DELETE CASCADE,
  member_id BIGINT NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. action_items
CREATE TABLE IF NOT EXISTS action_items (
  id BIGSERIAL PRIMARY KEY,
  meeting_note_id BIGINT NOT NULL REFERENCES meeting_notes(id) ON DELETE CASCADE,
  task TEXT NOT NULL,
  assigned_to BIGINT REFERENCES team_members(id) ON DELETE SET NULL,
  due_date DATE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
