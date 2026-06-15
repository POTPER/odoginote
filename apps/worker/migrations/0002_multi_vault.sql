CREATE TABLE IF NOT EXISTS user_vaults (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  owner TEXT NOT NULL,
  repo TEXT NOT NULL,
  last_opened_at TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(user_id, owner, repo)
);

ALTER TABLE users ADD COLUMN active_vault_id TEXT;

INSERT OR IGNORE INTO user_vaults (id, user_id, owner, repo, last_opened_at, created_at)
SELECT 'migrated-' || user_id, user_id, owner, repo, created_at, created_at FROM vaults;

UPDATE users
SET active_vault_id = (
  SELECT id FROM user_vaults WHERE user_vaults.user_id = users.id
  ORDER BY COALESCE(last_opened_at, '') DESC
  LIMIT 1
)
WHERE active_vault_id IS NULL
  AND EXISTS (SELECT 1 FROM user_vaults uv WHERE uv.user_id = users.id);

DROP TABLE IF EXISTS vaults;
