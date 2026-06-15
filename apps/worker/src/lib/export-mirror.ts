import type { NoteSummary } from "@odoginote/shared";
import { upsertRepoFile, uploadRepoBinaryFile } from "./github-rest";
import {
  extractUserAttachmentUrls,
  fetchUserAttachment,
} from "./github-user-attachments";

const VAULT_DIR = "vault";
const EXPORT_ASSETS_DIR = "vault/assets";

function slugify(title: string): string {
  const base = title
    .toLowerCase()
    .trim()
    .replace(/[^\w\u4e00-\u9fff]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || "untitled";
}

function assetRelativePrefix(folder: string): string {
  const depth = folder === "inbox" ? 1 : folder.split("/").length;
  return "../".repeat(depth) + "assets/";
}

function extFromContentType(contentType: string): string {
  if (contentType.includes("png")) return "png";
  if (contentType.includes("jpeg") || contentType.includes("jpg")) return "jpg";
  if (contentType.includes("gif")) return "gif";
  if (contentType.includes("webp")) return "webp";
  return "bin";
}

export interface ExportMirrorResult {
  files: Array<{ path: string; content: string }>;
  skippedAttachments: string[];
  mirroredCount: number;
}

export async function buildVaultExport(
  token: string,
  owner: string,
  repo: string,
  notes: NoteSummary[],
  userSession: string | null
): Promise<ExportMirrorResult> {
  const urlToRepoPath = new Map<string, string>();
  const skippedAttachments: string[] = [];
  let mirroredCount = 0;

  for (const note of notes) {
    const content = note.content ?? "";
    for (const url of extractUserAttachmentUrls(content)) {
      if (urlToRepoPath.has(url)) continue;

      if (!userSession) {
        skippedAttachments.push(url);
        continue;
      }

      try {
        const { data, contentType } = await fetchUserAttachment(url, {
          oauthToken: token,
          userSession,
        });
        const hash = url.replace(/[^a-z0-9]/gi, "").slice(-16) || crypto.randomUUID().slice(0, 12);
        const ext = extFromContentType(contentType);
        const filename = `${note.number}-${hash}.${ext}`;
        const repoPath = `${EXPORT_ASSETS_DIR}/${filename}`;
        await uploadRepoBinaryFile(
          token,
          owner,
          repo,
          repoPath,
          data,
          `Export mirror attachment from note #${note.number}`
        );
        urlToRepoPath.set(url, filename);
        mirroredCount++;
      } catch {
        skippedAttachments.push(url);
      }
    }
  }

  const files: Array<{ path: string; content: string }> = [];

  for (const note of notes) {
    const folder = note.folder || "inbox";
    const slug = slugify(note.title);
    const mdPath =
      folder === "inbox" ? `${VAULT_DIR}/inbox/${slug}.md` : `${VAULT_DIR}/${folder}/${slug}.md`;
    const prefix = assetRelativePrefix(folder);

    let body = note.content ?? "";
    for (const [url, filename] of urlToRepoPath) {
      body = body.split(url).join(`${prefix}${filename}`);
    }

    const yamlBlock = [
      "---",
      `title: "${note.title.replace(/"/g, '\\"')}"`,
      `issue: ${note.number}`,
      `folder: ${folder}`,
      `tags: [${note.tags.join(", ")}]`,
      note.daily ? `daily: ${note.daily}` : null,
      `updated: ${note.updatedAt}`,
      "---",
      "",
      body,
    ]
      .filter((line) => line !== null)
      .join("\n");

    files.push({ path: mdPath, content: yamlBlock });
  }

  const meta = {
    exportedAt: new Date().toISOString(),
    noteCount: notes.length,
    mirroredAttachments: mirroredCount,
    skippedAttachments,
  };
  files.push({
    path: ".odoginote/export-meta.json",
    content: JSON.stringify(meta, null, 2),
  });

  return { files, skippedAttachments, mirroredCount };
}

export async function commitVaultExport(
  token: string,
  owner: string,
  repo: string,
  files: Array<{ path: string; content: string }>
): Promise<void> {
  for (const file of files) {
    await upsertRepoFile(token, owner, repo, file.path, file.content, `Export vault: ${file.path}`);
  }
}
