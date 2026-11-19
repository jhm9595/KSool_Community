CREATE TABLE IF NOT EXISTS admin_roles (
  email TEXT PRIMARY KEY,
  permissions_json TEXT NOT NULL,
  added_by TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
