-- ============================================================
-- BACIRARO DASHBOARD UPGRADES - SQL MIGRATIONS
-- Run all in Supabase SQL Editor
-- ============================================================

-- ============================================================
-- PHASE 2: Activity Log
-- ============================================================
CREATE TABLE IF NOT EXISTS activity_log (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES team_members(id) ON DELETE SET NULL,
  user_name TEXT DEFAULT '',
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id BIGINT,
  entity_name TEXT DEFAULT '',
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_log_created ON activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_entity ON activity_log(entity_type, entity_id);

-- ============================================================
-- PHASE 2: Notifications
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES team_members(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  link TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read, created_at DESC);

-- ============================================================
-- PHASE 2: Payout fee opsional ke Kas Baciraro
-- (Fee 10% otomatis tetap ada, ini tambahan opsional)
-- ============================================================
ALTER TABLE payouts ADD COLUMN IF NOT EXISTS kas_optional_percent NUMERIC(5,2) DEFAULT 0;
ALTER TABLE payouts ADD COLUMN IF NOT EXISTS kas_optional_amount NUMERIC(14,2) DEFAULT 0;

-- ============================================================
-- PHASE 3: Recurring tasks
-- ============================================================
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS recurrence_rule VARCHAR(50);
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS recurrence_parent_id BIGINT REFERENCES tasks(id) ON DELETE SET NULL;

-- ============================================================
-- PHASE 3: File attachments
-- ============================================================
ALTER TABLE projects ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb;

-- ============================================================
-- PHASE 3: Project Templates
-- ============================================================
CREATE TABLE IF NOT EXISTS project_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  default_members JSONB DEFAULT '[]'::jsonb,
  default_tasks JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);
