import { Hono } from "hono";
import type { Env } from "../env";
import { getSession } from "../lib/session";
import { listUserRepos } from "../lib/github-rest";

/** @deprecated use /api/vaults/repos — kept for backward compatibility */
const repos = new Hono<{ Bindings: Env }>();

repos.get("/", async (c) => {
  const session = await getSession(c.env, c.req.raw);
  if (!session) return c.json({ error: "Unauthorized" }, 401);
  const ghRepos = await listUserRepos(session.token);
  return c.json(
    ghRepos.map((r) => ({
      name: r.name,
      fullName: r.full_name,
      owner: r.owner.login,
      private: r.private,
    }))
  );
});

repos.post("/setup", async (c) => {
  const url = new URL(c.req.url);
  url.pathname = "/api/vaults/setup";
  return c.redirect(url.pathname, 307);
});

export { repos };
