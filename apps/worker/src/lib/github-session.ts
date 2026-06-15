import type { Env } from "../env";
import {
  clearGitHubUserSession,
  getGitHubUserSessionRow,
  isGitHubUserSessionConnected,
  setGitHubUserSession,
} from "./db";
import { decryptWithSecret, encryptWithSecret } from "./session";

export class GitHubSessionError extends Error {
  constructor(
    message: string,
    public code: "GITHUB_SESSION_EXPIRED" | "GITHUB_SESSION_REQUIRED" | "INVALID_SESSION"
  ) {
    super(message);
    this.name = "GitHubSessionError";
  }
}

export async function saveGitHubUserSession(
  env: Env,
  userId: string,
  userSession: string
): Promise<void> {
  const trimmed = userSession.trim();
  if (!trimmed || trimmed.length < 20) {
    throw new GitHubSessionError("Invalid user_session value", "INVALID_SESSION");
  }
  const encrypted = await encryptWithSecret(env.SESSION_SECRET, trimmed);
  await setGitHubUserSession(env.D1_DB, userId, encrypted);
}

export async function removeGitHubUserSession(env: Env, userId: string): Promise<void> {
  await clearGitHubUserSession(env.D1_DB, userId);
}

export async function getGitHubUserSessionStatus(
  env: Env,
  userId: string
): Promise<{ connected: boolean; updatedAt: string | null }> {
  const row = await getGitHubUserSessionRow(env.D1_DB, userId);
  return {
    connected: Boolean(row),
    updatedAt: row?.updatedAt || null,
  };
}

export async function requireGitHubUserSession(env: Env, userId: string): Promise<string> {
  const row = await getGitHubUserSessionRow(env.D1_DB, userId);
  if (!row) {
    throw new GitHubSessionError(
      "GitHub browser session required for this operation",
      "GITHUB_SESSION_REQUIRED"
    );
  }
  const session = await decryptWithSecret(env.SESSION_SECRET, row.encrypted);
  if (!session) {
    await clearGitHubUserSession(env.D1_DB, userId);
    throw new GitHubSessionError("GitHub session expired, please reconnect", "GITHUB_SESSION_EXPIRED");
  }
  return session;
}

export async function hasGitHubUserSession(env: Env, userId: string): Promise<boolean> {
  return isGitHubUserSessionConnected(env.D1_DB, userId);
}

export async function tryGetGitHubUserSession(env: Env, userId: string): Promise<string | null> {
  const row = await getGitHubUserSessionRow(env.D1_DB, userId);
  if (!row) return null;
  const session = await decryptWithSecret(env.SESSION_SECRET, row.encrypted);
  if (!session) {
    await clearGitHubUserSession(env.D1_DB, userId);
    return null;
  }
  return session;
}
