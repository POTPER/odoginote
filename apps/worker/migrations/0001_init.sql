CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  login TEXT NOT NULL,
  avatar_url TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS vaults (
  user_id TEXT PRIMARY KEY REFERENCES users(id),
  owner TEXT NOT NULL,
  repo TEXT NOT NULL,
  created_at TEXT NOT NULL
);
