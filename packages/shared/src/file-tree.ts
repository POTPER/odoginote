import type { NoteSummary } from "./types.js";
import { buildFolderTree, type FolderNode } from "./folder-tree.js";

export interface FileTreeNode {
  type: "folder" | "note";
  name: string;
  path: string;
  number?: number;
  state?: "open" | "closed";
  children: FileTreeNode[];
}

export function buildFileTree(folders: string[], notes: NoteSummary[]): FileTreeNode[] {
  const allFolders = [...new Set([...folders, ...notes.map((n) => n.folder || "inbox")])];
  const folderTree = buildFolderTree(allFolders);

  function attachNotes(nodes: FolderNode[]): FileTreeNode[] {
    return nodes.map((folder) => {
      const folderNotes = notes
        .filter((n) => (n.folder || "inbox") === folder.path)
        .sort((a, b) => a.title.localeCompare(b.title))
        .map(
          (n): FileTreeNode => ({
            type: "note",
            name: n.title,
            path: `${folder.path}/${n.title}`,
            number: n.number,
            state: n.state,
            children: [],
          })
        );

      return {
        type: "folder" as const,
        name: folder.name,
        path: folder.path,
        children: [...attachNotes(folder.children), ...folderNotes],
      };
    });
  }

  return attachNotes(folderTree);
}
