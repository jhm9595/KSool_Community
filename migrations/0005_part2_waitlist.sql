CREATE TABLE IF NOT EXISTS part2_waitlist (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  nickname TEXT NOT NULL DEFAULT '',
  interest TEXT NOT NULL DEFAULT 'both',
  lang TEXT NOT NULL DEFAULT 'ko',
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS part2_waitlist_created ON part2_waitlist(created_at DESC);
