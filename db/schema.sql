CREATE TABLE IF NOT EXISTS reminders (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  text TEXT NOT NULL,
  date TEXT NOT NULL CHECK (date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  completed INTEGER NOT NULL DEFAULT 0 CHECK (completed IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_reminders_date_completed
  ON reminders (date, completed);

CREATE TABLE IF NOT EXISTS notification_logs (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  status TEXT NOT NULL CHECK (status IN ('success', 'error')),
  error_msg TEXT,
  sent_at TEXT DEFAULT (datetime('now'))
);
