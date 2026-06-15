import { Hono } from "hono";
import type { Env } from "../env";
import { getSession } from "../lib/session";
import { getActiveVault } from "../lib/db";
import { fetchAllNotes } from "../lib/github-graphql";
import { buildVaultExport, commitVaultExport } from "../lib/export-mirror";
import { getGitHubUserSessionRow } from "../lib/db";
import { decryptWithSecret } from "../lib/session";

const exportRoute = new Hono<{ Bindings: Env }>();

exportRoute.post("/", async (c) => {
  const session = await getSession(c.env, c.req.raw);
  if (!session) return c.json({ error: "Unauthorized" }, 401);

  const vault = await getActiveVault(c.env.D1_DB, session.userId);
  if (!vault) return c.json({ error: "Vault not configured" }, 400);

  const notes = await fetchAllNotes(session.token, vault.owner, vault.repo);

  let userSession: string | null = null;
  const row = await getGitHubUserSessionRow(c.env.D1_DB, session.userId);
  if (row) {
    userSession = await decryptWithSecret(c.env.SESSION_SECRET, row.encrypted);
  }

  const { files, skippedAttachments, mirroredCount } = await buildVaultExport(
    session.token,
    vault.owner,
    vault.repo,
    notes,
    userSession
  );

  await commitVaultExport(session.token, vault.owner, vault.repo, files);

  return c.json({
    ok: true,
    noteCount: notes.length,
    fileCount: files.length,
    mirroredAttachments: mirroredCount,
    skippedAttachments,
  });
});

export { exportRoute };
