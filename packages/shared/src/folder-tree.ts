export interface FolderNode {
  name: string;
  path: string;
  children: FolderNode[];
}

export function buildFolderTree(folders: string[]): FolderNode[] {
  const root: FolderNode[] = [];
  const sorted = [...new Set(folders.map((f) => f || "inbox"))].sort();

  for (const folderPath of sorted) {
    const parts = folderPath.split("/").filter(Boolean);
    if (parts.length === 0) parts.push("inbox");

    let level = root;
    let currentPath = "";
    for (const part of parts) {
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      let node = level.find((n) => n.name === part);
      if (!node) {
        node = { name: part, path: currentPath, children: [] };
        level.push(node);
      }
      level = node.children;
    }
  }

  return root;
}
