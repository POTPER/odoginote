import type { VaultConfig, VaultSummary } from "@odoginote/shared";

export interface UserVaultRow {
  id: string;
  user_id: string;
  owner: string;
  repo: string;
  last_opened_at: string | null;
  created_at: string;
}

export async function upsertUser(
  db: D1Database,
  user: { id: string; login: string; avatarUrl: string }
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO users (id, login, avatar_url, created_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET login = excluded.login, avatar_url = excluded.avatar_url`
    )
    .bind(user.id, user.login, user.avatarUrl, new Date().toISOString())
    .run();
}

export async function listUserVaults(db: D1Database, userId: string): Promise<VaultSummary[]> {
  const { results } = await db
    .prepare(
      `SELECT id, owner, repo, last_opened_at FROM user_vaults
       WHERE user_id = ? ORDER BY COALESCE(last_opened_at, '') DESC, created_at DESC`
    )
    .bind(userId)
    .all<{ id: string; owner: string; repo: string; last_opened_at: string | null }>();

  return (results ?? []).map((r) => ({
    id: r.id,
    owner: r.owner,
    repo: r.repo,
    lastOpenedAt: r.last_opened_at,
  }));
}

export async function getActiveVault(db: D1Database, userId: string): Promise<VaultConfig | null> {
  const user = await db
    .prepare("SELECT active_vault_id FROM users WHERE id = ?")
    .bind(userId)
    .first<{ active_vault_id: string | null }>();

  if (user?.active_vault_id) {
    const row = await db
      .prepare("SELECT owner, repo FROM user_vaults WHERE id = ? AND user_id = ?")
      .bind(user.active_vault_id, userId)
      .first<{ owner: string; repo: string }>();
    if (row) return { owner: row.owner, repo: row.repo };
  }

  const latest = await db
    .prepare(
      `SELECT owner, repo FROM user_vaults WHERE user_id = ?
       ORDER BY COALESCE(last_opened_at, '') DESC LIMIT 1`
    )
    .bind(userId)
    .first<{ owner: string; repo: string }>();

  return latest ? { owner: latest.owner, repo: latest.repo } : null;
}

export async function getUserVault(
  db: D1Database,
  userId: string,
  owner: string,
  repo: string
): Promise<VaultSummary | null> {
  const row = await db
    .prepare(
      "SELECT id, owner, repo, last_opened_at FROM user_vaults WHERE user_id = ? AND owner = ? AND repo = ?"
    )
    .bind(userId, owner, repo)
    .first<{ id: string; owner: string; repo: string; last_opened_at: string | null }>();

  if (!row) return null;
  return {
    id: row.id,
    owner: row.owner,
    repo: row.repo,
    lastOpenedAt: row.last_opened_at,
  };
}

export async function addUserVault(
  db: D1Database,
  userId: string,
  vault: VaultConfig
): Promise<VaultSummary> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await db
    .prepare(
      `INSERT INTO user_vaults (id, user_id, owner, repo, last_opened_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id, owner, repo) DO UPDATE SET last_opened_at = excluded.last_opened_at`
    )
    .bind(id, userId, vault.owner, vault.repo, now, now)
    .run();

  const row = await db
    .prepare("SELECT id, owner, repo, last_opened_at FROM user_vaults WHERE user_id = ? AND owner = ? AND repo = ?")
    .bind(userId, vault.owner, vault.repo)
    .first<{ id: string; owner: string; repo: string; last_opened_at: string | null }>();

  if (!row) throw new Error("Failed to add vault");

  await setActiveVault(db, userId, row.id);
  return { id: row.id, owner: row.owner, repo: row.repo, lastOpenedAt: row.last_opened_at };
}

export async function setActiveVault(db: D1Database, userId: string, vaultId: string): Promise<void> {
  const now = new Date().toISOString();
  await db
    .prepare("UPDATE user_vaults SET last_opened_at = ? WHERE id = ? AND user_id = ?")
    .bind(now, vaultId, userId)
    .run();
  await db
    .prepare("UPDATE users SET active_vault_id = ? WHERE id = ?")
    .bind(vaultId, userId)
    .run();
}

export async function switchVault(
  db: D1Database,
  userId: string,
  owner: string,
  repo: string
): Promise<VaultConfig | null> {
  const row = await db
    .prepare("SELECT id FROM user_vaults WHERE user_id = ? AND owner = ? AND repo = ?")
    .bind(userId, owner, repo)
    .first<{ id: string }>();
  if (!row) return null;
  await setActiveVault(db, userId, row.id);
  return { owner, repo };
}

export async function deleteUserVault(db: D1Database, userId: string, vaultId: string): Promise<boolean> {
  const row = await db
    .prepare("SELECT id FROM user_vaults WHERE id = ? AND user_id = ?")
    .bind(vaultId, userId)
    .first();
  if (!row) return false;

  await db.prepare("DELETE FROM user_vaults WHERE id = ? AND user_id = ?").bind(vaultId, userId).run();

  const user = await db
    .prepare("SELECT active_vault_id FROM users WHERE id = ?")
    .bind(userId)
    .first<{ active_vault_id: string | null }>();

  if (user?.active_vault_id === vaultId) {
    const next = await db
      .prepare(
        `SELECT id FROM user_vaults WHERE user_id = ?
         ORDER BY COALESCE(last_opened_at, '') DESC LIMIT 1`
      )
      .bind(userId)
      .first<{ id: string }>();
    await db
      .prepare("UPDATE users SET active_vault_id = ? WHERE id = ?")
      .bind(next?.id ?? null, userId)
      .run();
  }
  return true;
}

export async function getUserProfile(
  db: D1Database,
  userId: string
): Promise<{
  login: string;
  avatarUrl: string;
  vaults: VaultSummary[];
  activeVault: VaultConfig | null;
} | null> {
  const user = await db
    .prepare("SELECT login, avatar_url FROM users WHERE id = ?")
    .bind(userId)
    .first<{ login: string; avatar_url: string }>();
  if (!user) return null;

  const vaults = await listUserVaults(db, userId);
  const activeVault = await getActiveVault(db, userId);
  return { login: user.login, avatarUrl: user.avatar_url, vaults, activeVault };
}

/** @deprecated use getActiveVault */
export async function getVault(db: D1Database, userId: string): Promise<VaultConfig | null> {
  return getActiveVault(db, userId);
}

/** @deprecated use addUserVault */
export async function setVault(db: D1Database, userId: string, vault: VaultConfig): Promise<void> {
  await addUserVault(db, userId, vault);
}

export async function setGitHubUserSession(
  db: D1Database,
  userId: string,
  encrypted: string
): Promise<void> {
  await db
    .prepare(
      `UPDATE users SET github_session_enc = ?, github_session_updated_at = ? WHERE id = ?`
    )
    .bind(encrypted, new Date().toISOString(), userId)
    .run();
}

export async function getGitHubUserSessionRow(
  db: D1Database,
  userId: string
): Promise<{ encrypted: string; updatedAt: string } | null> {
  const row = await db
    .prepare("SELECT github_session_enc, github_session_updated_at FROM users WHERE id = ?")
    .bind(userId)
    .first<{ github_session_enc: string | null; github_session_updated_at: string | null }>();

  if (!row?.github_session_enc) return null;
  return {
    encrypted: row.github_session_enc,
    updatedAt: row.github_session_updated_at ?? "",
  };
}

export async function clearGitHubUserSession(db: D1Database, userId: string): Promise<void> {
  await db
    .prepare(
      `UPDATE users SET github_session_enc = NULL, github_session_updated_at = NULL WHERE id = ?`
    )
    .bind(userId)
    .run();
}

export async function isGitHubUserSessionConnected(db: D1Database, userId: string): Promise<boolean> {
  const row = await db
    .prepare("SELECT github_session_enc FROM users WHERE id = ?")
    .bind(userId)
    .first<{ github_session_enc: string | null }>();
  return Boolean(row?.github_session_enc);
}
