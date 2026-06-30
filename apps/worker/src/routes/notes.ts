import { Hono } from "hono";
import {
  NOTE_LABEL,
  buildGraph,
  createEmptyExcalidrawScene,
  createEmptyNotebook,
  createEmptyTodoList,
  parseFrontmatter,
  serializeExcalidrawContent,
  serializeNotebookContent,
  serializeTodoContent,
  serializeFrontmatter,
  type NoteDetail,
  type NoteMeta,
  type NoteType,
} from "@odoginote/shared";
import type { Env } from "../env";
import { getSession } from "../lib/session";
import { getActiveVault } from "../lib/db";
import { GitHubError, createIssue, getIssue, updateIssue } from "../lib/github-rest";
import { fetchAllNotes } from "../lib/github-graphql";

const notes = new Hono<{ Bindings: Env }>();

async function requireVault(c: { env: Env; req: { raw: Request } }) {
  const session = await getSession(c.env, c.req.raw);
  if (!session) return { error: c.json({ error: "Unauthorized" }, 401) };
  const vault = await getActiveVault(c.env.D1_DB, session.userId);
  if (!vault) return { error: c.json({ error: "Vault not configured" }, 400) };
  return { session, vault };
}

function toDetail(issue: {
  number: number;
  title: string;
  body: string | null;
  state: "open" | "closed";
  updated_at: string;
}): NoteDetail {
  const { meta, content } = parseFrontmatter(issue.body ?? "");
  return {
    number: issue.number,
    title: issue.title,
    folder: meta.folder,
    tags: meta.tags,
    daily: meta.daily,
    type: meta.type,
    state: issue.state,
    updatedAt: issue.updated_at,
    content,
  };
}

notes.get("/index", async (c) => {
  const ctx = await requireVault(c);
  if ("error" in ctx) return ctx.error;
  const { session, vault } = ctx;

  const notesList = await fetchAllNotes(session.token, vault.owner, vault.repo);
  const folder = c.req.query("folder");
  const q = c.req.query("q")?.toLowerCase();
  const state = c.req.query("state") as "open" | "closed" | undefined;

  let filtered = notesList;
  if (folder) filtered = filtered.filter((n) => n.folder === folder);
  if (state) filtered = filtered.filter((n) => n.state === state);
  if (q) {
    filtered = filtered.filter((n) => {
      const inTitle = n.title.toLowerCase().includes(q);
      const inTags = n.tags.some((t) => t.toLowerCase().includes(q));
      const inBody = (n.content ?? "").toLowerCase().includes(q);
      return inTitle || inTags || inBody;
    });
  }

  return c.json({ notes: filtered.map(({ content: _c, ...rest }) => rest) });
});

notes.get("/graph", async (c) => {
  const ctx = await requireVault(c);
  if ("error" in ctx) return ctx.error;
  const { session, vault } = ctx;
  const notesList = await fetchAllNotes(session.token, vault.owner, vault.repo);
  return c.json(buildGraph(notesList));
});

notes.get("/:number", async (c) => {
  const ctx = await requireVault(c);
  if ("error" in ctx) return ctx.error;
  const { session, vault } = ctx;
  const number = parseInt(c.req.param("number"), 10);

  const issue = await getIssue(session.token, vault.owner, vault.repo, number);
  return c.json(toDetail(issue));
});

notes.post("/", async (c) => {
  const ctx = await requireVault(c);
  if ("error" in ctx) return ctx.error;
  const { session, vault } = ctx;

  const body = await c.req.json<{
    title: string;
    content?: string;
    folder?: string;
    tags?: string[];
    daily?: string;
    type?: NoteType;
  }>();

  const noteType = body.type ?? "markdown";
  const meta: NoteMeta = {
    folder: body.folder ?? "inbox",
    tags: body.tags ?? [],
    daily: body.daily,
    type:
      noteType === "excalidraw" || noteType === "ipynb" || noteType === "todo"
        ? noteType
        : undefined,
  };
  const defaultContent =
    noteType === "excalidraw"
      ? serializeExcalidrawContent(createEmptyExcalidrawScene())
      : noteType === "ipynb"
        ? serializeNotebookContent(createEmptyNotebook())
        : noteType === "todo"
          ? serializeTodoContent(createEmptyTodoList())
          : "";
  const issueBody = serializeFrontmatter(meta, body.content ?? defaultContent);

  const issue = await createIssue(session.token, vault.owner, vault.repo, {
    title: body.title || "Untitled",
    body: issueBody,
    labels: [NOTE_LABEL],
  });

  return c.json(toDetail(issue), 201);
});

notes.patch("/:number", async (c) => {
  const ctx = await requireVault(c);
  if ("error" in ctx) return ctx.error;
  const { session, vault } = ctx;
  const number = parseInt(c.req.param("number"), 10);

  const body = await c.req.json<{
    title?: string;
    content?: string;
    folder?: string;
    tags?: string[];
    state?: "open" | "closed";
    expectedUpdatedAt?: string;
  }>();

  let patchBody: { title?: string; body?: string; state?: "open" | "closed" } = {};
  if (body.title !== undefined) patchBody.title = body.title;
  if (body.state !== undefined) patchBody.state = body.state;

  if (
    body.content !== undefined ||
    body.folder !== undefined ||
    body.tags !== undefined
  ) {
    const current = await getIssue(session.token, vault.owner, vault.repo, number);
    const { meta, content } = parseFrontmatter(current.body ?? "");
    const newMeta: NoteMeta = {
      folder: body.folder ?? meta.folder,
      tags: body.tags ?? meta.tags,
      daily: meta.daily,
      type: meta.type,
    };
    const newContent = body.content ?? content;
    patchBody.body = serializeFrontmatter(newMeta, newContent);
  }

  try {
    const issue = await updateIssue(
      session.token,
      vault.owner,
      vault.repo,
      number,
      patchBody,
      body.expectedUpdatedAt
    );
    return c.json(toDetail(issue));
  } catch (e) {
    if (e instanceof GitHubError && e.status === 409) {
      return c.json({ error: "Conflict: note was modified elsewhere" }, 409);
    }
    throw e;
  }
});

export { notes };
