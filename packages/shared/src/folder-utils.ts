import type { NoteSummary } from "./types.js";

export function folderHasNotes(folderPath: string, notes: NoteSummary[]): boolean {
  return notes.some((n) => {
    const f = n.folder || "inbox";
    return f === folderPath || f.startsWith(`${folderPath}/`);
  });
}

export function canDeleteFolder(
  folderPath: string,
  folders: string[],
  notes: NoteSummary[]
): boolean {
  if (!folderPath || folderPath === "inbox") return false;
  if (!folders.includes(folderPath)) return false;
  if (folderHasNotes(folderPath, notes)) return false;
  if (folders.some((f) => f.startsWith(`${folderPath}/`))) return false;
  return true;
}
