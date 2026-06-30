import type { NoteMeta, NoteType } from "./types.js";

function parseNoteType(raw: string): NoteType | undefined {
  const value = raw.replace(/^['"]|['"]$/g, "");
  if (value === "excalidraw" || value === "markdown" || value === "ipynb") return value;
  return undefined;
}

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

function parseYamlLine(line: string): [string, string] | null {
  const idx = line.indexOf(":");
  if (idx === -1) return null;
  return [line.slice(0, idx).trim(), line.slice(idx + 1).trim()];
}

function parseTags(raw: string): string[] {
  const trimmed = raw.trim();
  if (!trimmed || trimmed === "[]") return [];
  if (trimmed.startsWith("[")) {
    return trimmed
      .slice(1, -1)
      .split(",")
      .map((t) => t.trim().replace(/^['"]|['"]$/g, ""))
      .filter(Boolean);
  }
  return trimmed.split(",").map((t) => t.trim()).filter(Boolean);
}

export function parseFrontmatter(body: string): { meta: NoteMeta; content: string } {
  const match = body.match(FRONTMATTER_RE);
  if (!match) {
    return { meta: { folder: "inbox", tags: [] }, content: body.trim() };
  }

  const meta: NoteMeta = { folder: "inbox", tags: [] };
  for (const line of match[1].split("\n")) {
    const parsed = parseYamlLine(line);
    if (!parsed) continue;
    const [key, value] = parsed;
    if (key === "folder") meta.folder = value.replace(/^['"]|['"]$/g, "") || "inbox";
    if (key === "tags") meta.tags = parseTags(value);
    if (key === "daily") meta.daily = value.replace(/^['"]|['"]$/g, "");
    if (key === "type") meta.type = parseNoteType(value);
  }

  return { meta, content: body.slice(match[0].length).trim() };
}

export function serializeFrontmatter(meta: NoteMeta, content: string): string {
  const lines = ["---"];
  lines.push(`folder: ${meta.folder || "inbox"}`);
  if (meta.tags.length > 0) {
    lines.push(`tags: [${meta.tags.join(", ")}]`);
  } else {
    lines.push("tags: []");
  }
  if (meta.daily) lines.push(`daily: ${meta.daily}`);
  if (meta.type === "excalidraw") lines.push("type: excalidraw");
  if (meta.type === "ipynb") lines.push("type: ipynb");
  lines.push("---", "", content.trim());
  return lines.join("\n");
}
