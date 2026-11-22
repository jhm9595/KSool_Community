CREATE TABLE IF NOT EXISTS affiliate_partners (
  id TEXT PRIMARY KEY,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0,1)),
  sort_order INTEGER NOT NULL DEFAULT 100,
  locales_json TEXT NOT NULL DEFAULT '["ko"]',
  icon TEXT NOT NULL DEFAULT '🛍️',
  url TEXT NOT NULL,
  name_json TEXT NOT NULL DEFAULT '{}',
  badge_json TEXT NOT NULL DEFAULT '{}',
  desc_json TEXT NOT NULL DEFAULT '{}',
  disclosure_json TEXT NOT NULL DEFAULT '{}',
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS affiliate_partners_order ON affiliate_partners(sort_order ASC, id ASC);
