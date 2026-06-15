import { Hono } from "hono";
import { CONFIG_PATH, FOLDERS_PATH, NOTE_LABEL, serializeFrontmatter } from "@odoginote/shared";
import type { Env } from "../env";
import { getSession } from "../lib/session";
import {
  addUserVault,
  deleteUserVault,
  getActiveVault,
  getUserVault,
  listUserVaults,
  switchVault,
} from "../lib/db";
import { fetchAllNotes } from "../lib/github-graphql";
import {
  createFile,
  createIssue,
  createRepo,
  ensureLabel,
  getRepoFile,
  GitHubError,
  listUserRepos,
  upsertRepoFile,
} from "../lib/github-rest";

const vaults = new Hono<{ Bindings: Env }>();

const WELCOME_TITLE = "Welcome to GiNote";

async function requireAuth(c: { env: Env; req: { raw: Request } }) {
  const session = await getSession(c.env, c.req.raw);
  if (!session) return null;
  return session;
}

function hasWelcomeNote(notes: { title: string; tags: string[] }[]): boolean {
  return notes.some(
    (n) => n.title === WELCOME_TITLE || n.tags.includes("welcome")
  );
}

async function ensureVaultInitialized(token: string, owner: string, repo: string) {
  const config = await getRepoFile(token, owner, repo, CONFIG_PATH);
  if (config) return;

  await ensureLabel(token, owner, repo, NOTE_LABEL);

  const welcomeBody = serializeFrontmatter(
    { folder: "inbox", tags: ["welcome"] },
    `# Welcome to GiNote

This note lives as a GitHub Issue in your repo.

- Folder and tags are in frontmatter
- Each note = one Issue with label \`${NOTE_LABEL}\`
`
  );

  try {
    await createFile(
      token,
      owner,
      repo,
      "README.md",
      `# ${repo}\n\nGiNote vault — notes stored as GitHub Issues.\n`,
      "Initialize GiNote vault"
    );
  } catch (e) {
    if (!(e instanceof GitHubError && e.status === 422)) throw e;
  }

  try {
    await createFile(
      token,
      owner,
      repo,
      FOLDERS_PATH,
      JSON.stringify({ folders: ["inbox"] }, null, 2),
      "Initialize GiNote folders"
    );
  } catch (e) {
    if (!(e instanceof GitHubError && e.status === 422)) throw e;
  }

  const notes = await fetchAllNotes(token, owner, repo);
  if (!hasWelcomeNote(notes)) {
    await createIssue(token, owner, repo, {
      title: WELCOME_TITLE,
      body: welcomeBody,
      labels: [NOTE_LABEL],
    });
  }

  const configContent = JSON.stringify(
    { version: 1, initializedAt: new Date().toISOString() },
    null,
    2
  );
  await upsertRepoFile(
    token,
    owner,
    repo,
    CONFIG_PATH,
    configContent,
    "Mark GiNote vault initialized"
  );
}

vaults.get("/", async (c) => {
  const session = await requireAuth(c);
  if (!session) return c.json({ error: "Unauthorized" }, 401);
  const list = await listUserVaults(c.env.D1_DB, session.userId);
  const active = await getActiveVault(c.env.D1_DB, session.userId);
  return c.json({ vaults: list, activeVault: active });
});

vaults.get("/repos", async (c) => {
  const session = await requireAuth(c);
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

vaults.post("/setup", async (c) => {
  const session = await requireAuth(c);
  if (!session) return c.json({ error: "Unauthorized" }, 401);

  const body = await c.req.json<{
    mode: "create" | "existing";
    repoName?: string;
    owner?: string;
    repo?: string;
  }>();

  let owner: string;
  let repo: string;

  if (body.mode === "create") {
    const name = body.repoName ?? "ginote";
    const created = await createRepo(session.token, name, true);
    owner = created.owner.login;
    repo = created.name;
  } else {
    if (!body.owner || !body.repo) {
      return c.json({ error: "owner and repo required" }, 400);
    }
    owner = body.owner;
    repo = body.repo;
  }

  const alreadyBound = await getUserVault(c.env.D1_DB, session.userId, owner, repo);
  if (!alreadyBound) {
    await ensureVaultInitialized(session.token, owner, repo);
  }

  const summary = await addUserVault(c.env.D1_DB, session.userId, { owner, repo });
  return c.json({ owner, repo, vault: summary });
});

vaults.post("/switch", async (c) => {
  const session = await requireAuth(c);
  if (!session) return c.json({ error: "Unauthorized" }, 401);

  const { owner, repo } = await c.req.json<{ owner: string; repo: string }>();
  const switched = await switchVault(c.env.D1_DB, session.userId, owner, repo);
  if (!switched) return c.json({ error: "Vault not found" }, 404);
  return c.json({ activeVault: switched });
});

vaults.delete("/:id", async (c) => {
  const session = await requireAuth(c);
  if (!session) return c.json({ error: "Unauthorized" }, 401);
  const ok = await deleteUserVault(c.env.D1_DB, session.userId, c.req.param("id"));
  if (!ok) return c.json({ error: "Vault not found" }, 404);
  const list = await listUserVaults(c.env.D1_DB, session.userId);
  const active = await getActiveVault(c.env.D1_DB, session.userId);
  return c.json({ vaults: list, activeVault: active });
});

export { vaults };
