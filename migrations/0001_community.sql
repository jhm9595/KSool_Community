PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS suggestions (
  suggestion_key TEXT PRIMARY KEY,
  items_json TEXT NOT NULL,
  is_applied INTEGER NOT NULL DEFAULT 0 CHECK(is_applied IN (0,1)),
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY,
  actor_id TEXT NOT NULL REFERENCES sessions(id),
  kind TEXT NOT NULL CHECK(kind IN ('tip','experiment')),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  author TEXT NOT NULL,
  recipe_id INTEGER,
  suggestion_key TEXT REFERENCES suggestions(suggestion_key),
  target_key TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  deleted_at INTEGER
);
CREATE INDEX IF NOT EXISTS posts_recent ON posts(deleted_at,created_at DESC,id);
CREATE INDEX IF NOT EXISTS posts_suggestion ON posts(suggestion_key);
CREATE TABLE IF NOT EXISTS votes (
  target_key TEXT NOT NULL,
  actor_id TEXT NOT NULL REFERENCES sessions(id),
  direction TEXT NOT NULL CHECK(direction IN ('UP','DOWN')),
  PRIMARY KEY(target_key,actor_id)
);
CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL REFERENCES posts(id),
  actor_id TEXT NOT NULL REFERENCES sessions(id),
  author TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS comments_post ON comments(post_id,created_at);
CREATE TABLE IF NOT EXISTS reports (
  post_id TEXT NOT NULL REFERENCES posts(id),
  actor_id TEXT NOT NULL REFERENCES sessions(id),
  reason TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY(post_id,actor_id)
);
CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  hits INTEGER NOT NULL
);
