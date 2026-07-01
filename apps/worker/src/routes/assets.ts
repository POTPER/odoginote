import { Hono } from "hono";
import { IMAGE_MIME_EXT, ASSETS_DIR } from "@odoginote/shared";
import type { Env } from "../env";
import { getRepoBinaryFile, uploadRepoBinaryFile, getRepo } from "../lib/github-rest";
import { requireGitHubUserSession, GitHubSessionError, tryGetGitHubUserSession } from "../lib/github-session";
import { isGitHubAttachmentUrl } from "@odoginote/shared";
import {
  fetchUserAttachment,
  uploadUserAttachment,
} from "../lib/github-user-attachments";
import { requireVault } from "../middleware/require-auth";

const assets = new Hono<{ Bindings: Env }>();

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

function isValidAssetPath(path: string): boolean {
  return path.startsWith(`${ASSETS_DIR}/`) && !path.includes("..");
}

function sessionErrorResponse(c: { json: (body: unknown, status?: number) => Response }, e: GitHubSessionError) {
  return c.json({ error: e.message, code: e.code }, e.code === "GITHUB_SESSION_REQUIRED" ? 400 : 401);
}

assets.get("/proxy", async (c) => {
  const ctx = await requireVault(c);
  if ("error" in ctx) return ctx.error;
  const { session } = ctx;

  const url = c.req.query("url");
  if (!url || !isGitHubAttachmentUrl(url)) {
    return c.json({ error: "Invalid URL" }, 400);
  }

  try {
    const userSession = await tryGetGitHubUserSession(c.env, session.userId);
    const { data, contentType } = await fetchUserAttachment(url, {
      oauthToken: session.token,
      userSession,
    });
    return new Response(data, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (e) {
    if (e instanceof GitHubSessionError) return sessionErrorResponse(c, e);
    throw e;
  }
});

assets.post("/", async (c) => {
  const ctx = await requireVault(c);
  if ("error" in ctx) return ctx.error;
  const { session, vault } = ctx;

  const body = await c.req.parseBody();
  const file = body.file;
  const noteNumber = parseInt(String(body.noteNumber ?? ""), 10);
  const storage = String(body.storage ?? "github-attachments");

  if (!(file instanceof File)) {
    return c.json({ error: "No file provided" }, 400);
  }
  if (!noteNumber || isNaN(noteNumber)) {
    return c.json({ error: "noteNumber required" }, 400);
  }
  if (!IMAGE_MIME_EXT[file.type]) {
    return c.json({ error: "Unsupported image type" }, 400);
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return c.json({ error: "Image too large (max 5MB)" }, 400);
  }

  const ext = IMAGE_MIME_EXT[file.type];
  const filename = `${noteNumber}-${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
  const data = await file.arrayBuffer();

  if (storage === "repo") {
    const repoPath = `${ASSETS_DIR}/${filename}`;
    await uploadRepoBinaryFile(
      session.token,
      vault.owner,
      vault.repo,
      repoPath,
      data,
      `Upload image for note #${noteNumber}`
    );
    const url = `/api/assets/${repoPath}`;
    return c.json({ url, path: repoPath }, 201);
  }

  try {
    const userSession = await requireGitHubUserSession(c.env, session.userId);
    const repoInfo = await getRepo(session.token, vault.owner, vault.repo);
    const href = await uploadUserAttachment(
      userSession,
      vault.owner,
      vault.repo,
      repoInfo.id,
      filename,
      file.type,
      data
    );
    return c.json({ url: href, path: href }, 201);
  } catch (e) {
    if (e instanceof GitHubSessionError) return sessionErrorResponse(c, e);
    throw e;
  }
});

assets.get("*", async (c) => {
  const ctx = await requireVault(c);
  if ("error" in ctx) return ctx.error;
  const { session, vault } = ctx;

  const path = c.req.param("*") ?? "";
  if (!path || !isValidAssetPath(path)) {
    return c.json({ error: "Invalid path" }, 400);
  }

  const file = await getRepoBinaryFile(session.token, vault.owner, vault.repo, path);
  if (!file) return c.json({ error: "Not found" }, 404);

  return new Response(file.data, {
    headers: {
      "Content-Type": file.contentType,
      "Cache-Control": "private, max-age=3600",
    },
  });
});

export { assets };
