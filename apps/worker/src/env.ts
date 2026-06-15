export interface Env {
  KV_SESSION: KVNamespace;
  D1_DB: D1Database;
  ASSETS: Fetcher;
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  SESSION_SECRET: string;
  APP_URL: string;
}

export interface SessionData {
  userId: string;
  token: string;
  expiresAt: number;
}

export interface GitHubUser {
  id: number;
  login: string;
  avatar_url: string;
}

export interface GitHubIssue {
  number: number;
  title: string;
  body: string | null;
  state: "open" | "closed";
  updated_at: string;
  pull_request?: unknown;
  labels: Array<{ name: string }>;
}

export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  owner: { login: string };
}
