import { Hono } from "hono";
import { FOLDERS_PATH, buildFileTree, canDeleteFolder } from "@odoginote/shared";
import type { Env } from "../env";
import { getSession } from "../lib/session";
import { getActiveVault } from "../lib/db";
import { getRepoFile, upsertRepoFile } from "../lib/github-rest";
import { fetchAllNotes } from "../lib/github-graphql";

const folders = new Hono<{ Bindings: Env }>();

async function requireVault(c: { env: Env; req: { raw: Request } }) {
  const session = await getSession(c.env, c.req.raw);
  if (!session) return { error: c.json({ error: "Unauthorized" }, 401) };
  const vault = await getActiveVault(c.env.D1_DB, session.userId);
  if (!vault) return { error: c.json({ error: "Vault not configured" }, 400) };
  return { session, vault };
}

async function readFolders(
  token: string,
  owner: string,
  repo: string
): Promise<{ folders: string[]; sha?: string }> {
  const file = await getRepoFile(token, owner, repo, FOLDERS_PATH);
  if (!file) return { folders: ["inbox"] };
  try {
    const data = JSON.parse(file.content) as { folders?: string[] };
    return { folders: data.folders?.length ? data.folders : ["inbox"], sha: file.sha };
  } catch {
    return { folders: ["inbox"], sha: file.sha };
  }
}

folders.get("/", async (c) => {
  const ctx = await requireVault(c);
  if ("error" in ctx) return ctx.error;
  const { session, vault } = ctx;

  const { folders: folderList } = await readFolders(session.token, vault.owner, vault.repo);
  const notes = await fetchAllNotes(session.token, vault.owner, vault.repo);
  const tree = buildFileTree(folderList, notes);

  return c.json({ folders: folderList, tree, notes });
});

folders.post("/", async (c) => {
  const ctx = await requireVault(c);
  if ("error" in ctx) return ctx.error;
  const { session, vault } = ctx;

  const { path } = await c.req.json<{ path: string }>();
  const normalized = path.trim().replace(/^\/+|\/+$/g, "");
  if (!normalized) return c.json({ error: "Invalid folder path" }, 400);

  const { folders: existing, sha } = await readFolders(session.token, vault.owner, vault.repo);
  if (existing.includes(normalized)) {
    return c.json({ folders: existing, path: normalized });
  }

  const updated = [...existing, normalized].sort();
  const content = JSON.stringify({ folders: updated }, null, 2);
  await upsertRepoFile(
    session.token,
    vault.owner,
    vault.repo,
    FOLDERS_PATH,
    content,
    `Add folder ${normalized}`,
    sha
  );

  return c.json({ folders: updated, path: normalized }, 201);
});

folders.delete("/", async (c) => {
  const ctx = await requireVault(c);
  if ("error" in ctx) return ctx.error;
  const { session, vault } = ctx;

  const { path } = await c.req.json<{ path: string }>();
  const normalized = path.trim().replace(/^\/+|\/+$/g, "");
  if (!normalized) return c.json({ error: "Invalid folder path" }, 400);
  if (normalized === "inbox") return c.json({ error: "Cannot delete inbox" }, 400);

  const { folders: existing, sha } = await readFolders(session.token, vault.owner, vault.repo);
  if (!existing.includes(normalized)) {
    return c.json({ error: "Folder not in folders list" }, 404);
  }

  const notes = await fetchAllNotes(session.token, vault.owner, vault.repo);
  if (!canDeleteFolder(normalized, existing, notes)) {
    return c.json({ error: "Folder is not empty" }, 400);
  }

  const updated = existing.filter((f) => f !== normalized);
  const content = JSON.stringify({ folders: updated }, null, 2);
  await upsertRepoFile(
    session.token,
    vault.owner,
    vault.repo,
    FOLDERS_PATH,
    content,
    `Remove folder ${normalized}`,
    sha
  );

  return c.json({ folders: updated, path: normalized });
});

export { folders };
