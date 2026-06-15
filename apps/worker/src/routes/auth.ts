import { Hono } from "hono";
import type { Env } from "../env";
import {
  clearSessionCookie,
  createSession,
  destroySession,
  getSession,
  sessionCookie,
} from "../lib/session";
import { exchangeCode, getGitHubUser, GitHubError } from "../lib/github-rest";
import { upsertUser, listUserVaults } from "../lib/db";

const auth = new Hono<{ Bindings: Env }>();

auth.get("/github", (c) => {
  const clientId = c.env.GITHUB_CLIENT_ID;
  if (!clientId) return c.json({ error: "GITHUB_CLIENT_ID not configured" }, 500);

  const redirectUri = `${c.env.APP_URL}/api/auth/callback`;
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: "read:user repo",
  });
  return c.redirect(`https://github.com/login/oauth/authorize?${params}`);
});

auth.get("/callback", async (c) => {
  const code = c.req.query("code");
  if (!code) return c.text("Missing code", 400);

  const redirectUri = `${c.env.APP_URL}/api/auth/callback`;

  try {
    const { access_token } = await exchangeCode(
      c.env.GITHUB_CLIENT_ID,
      c.env.GITHUB_CLIENT_SECRET,
      code,
      redirectUri
    );

    const ghUser = await getGitHubUser(access_token);
    const userId = String(ghUser.id);
    await upsertUser(c.env.D1_DB, {
      id: userId,
      login: ghUser.login,
      avatarUrl: ghUser.avatar_url,
    });

    const sessionId = await createSession(c.env, userId, access_token);
    c.header("Set-Cookie", sessionCookie(sessionId, 30 * 24 * 3600));

    const vaults = await listUserVaults(c.env.D1_DB, userId);
    const dest = vaults.length > 0 ? "/vault" : "/onboarding";
    return c.redirect(`${c.env.APP_URL}${dest}`);
  } catch (e) {
    const callbackHint = `Check GitHub OAuth App callback URL matches exactly: ${redirectUri}`;
    if (e instanceof GitHubError) {
      return c.json(
        {
          error: e.message,
          status: e.status,
          details: e.body,
          hint: e.status === 403 ? callbackHint : undefined,
        },
        e.status >= 400 && e.status < 600 ? (e.status as 400) : 500
      );
    }
    throw e;
  }
});

auth.get("/logout", async (c) => {
  await destroySession(c.env, c.req.raw);
  c.header("Set-Cookie", clearSessionCookie());
  return c.redirect(`${c.env.APP_URL}/`);
});

auth.get("/me", async (c) => {
  const session = await getSession(c.env, c.req.raw);
  if (!session) return c.json({ error: "Unauthorized" }, 401);

  const { getUserProfile } = await import("../lib/db");
  const profile = await getUserProfile(c.env.D1_DB, session.userId);
  if (!profile) return c.json({ error: "User not found" }, 404);

  return c.json({
    id: session.userId,
    login: profile.login,
    avatarUrl: profile.avatarUrl,
    vaults: profile.vaults,
    activeVault: profile.activeVault,
  });
});

auth.get("/github-session", async (c) => {
  const session = await getSession(c.env, c.req.raw);
  if (!session) return c.json({ error: "Unauthorized" }, 401);

  const { getGitHubUserSessionStatus } = await import("../lib/github-session");
  const status = await getGitHubUserSessionStatus(c.env, session.userId);
  return c.json(status);
});

auth.post("/github-session", async (c) => {
  const session = await getSession(c.env, c.req.raw);
  if (!session) return c.json({ error: "Unauthorized" }, 401);

  const body = await c.req.json<{ userSession?: string }>();
  if (!body.userSession?.trim()) {
    return c.json({ error: "userSession required" }, 400);
  }

  const { saveGitHubUserSession, GitHubSessionError } = await import("../lib/github-session");
  try {
    await saveGitHubUserSession(c.env, session.userId, body.userSession);
    const status = await import("../lib/github-session").then((m) =>
      m.getGitHubUserSessionStatus(c.env, session.userId)
    );
    return c.json({ ok: true, ...status });
  } catch (e) {
    if (e instanceof GitHubSessionError) {
      return c.json({ error: e.message, code: e.code }, 400);
    }
    throw e;
  }
});

auth.delete("/github-session", async (c) => {
  const session = await getSession(c.env, c.req.raw);
  if (!session) return c.json({ error: "Unauthorized" }, 401);

  const { removeGitHubUserSession } = await import("../lib/github-session");
  await removeGitHubUserSession(c.env, session.userId);
  return c.json({ ok: true, connected: false });
});

export { auth };
