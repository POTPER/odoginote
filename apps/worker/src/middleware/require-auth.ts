import type { Context } from "hono";
import type { Env, SessionData } from "../env";
import { getActiveVault } from "../lib/db";
import { getSession } from "../lib/session";

export async function requireVault(c: Context<{ Bindings: Env }>) {
  const session = await getSession(c.env, c.req.raw);
  if (!session) return { error: c.json({ error: "Unauthorized" }, 401) };
  const vault = await getActiveVault(c.env.D1_DB, session.userId);
  if (!vault) return { error: c.json({ error: "Vault not configured" }, 400) };
  return { session, vault };
}

export async function requireAuth(c: Context<{ Bindings: Env }>): Promise<
  { error: Response } | { session: SessionData }
> {
  const session = await getSession(c.env, c.req.raw);
  if (!session) return { error: c.json({ error: "Unauthorized" }, 401) };
  return { session };
}
