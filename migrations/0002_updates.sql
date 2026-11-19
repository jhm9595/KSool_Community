CREATE TABLE IF NOT EXISTS updates (
  id TEXT PRIMARY KEY,
  version TEXT NOT NULL,
  date TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS updates_recent ON updates(created_at DESC);
