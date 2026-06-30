CREATE TABLE IF NOT EXISTS reminders (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  text TEXT NOT NULL,
  date TEXT NOT NULL,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  completed INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_reminders_date_completed
  ON reminders (date, completed);

CREATE TABLE IF NOT EXISTS notification_logs (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  channel TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('sent', 'failed')),
  message TEXT,
  error TEXT,
  sent_at TEXT DEFAULT (datetime('now'))
);
