import type { FileTreeNode, NoteSummary } from "@odoginote/shared";
import { useState } from "react";

interface Props {
  tree: FileTreeNode[];
  notes: NoteSummary[];
  activeFolder: string | null;
  selectedNumber: number | null;
  onSelectFolder: (path: string | null) => void;
  onSelectNote: (number: number, title: string) => void;
  onNewNote: () => void;
  onNewExcalidrawNote: () => void;
  onNewNotebookNote: () => void;
  onNewTodoNote: () => void;
  onNewFolder: () => void;
  onDeleteFolder?: () => void;
  canDeleteFolder?: boolean;
  newNoteDisabled?: boolean;
}

export default function FileExplorer({
  tree,
  notes,
  activeFolder,
  selectedNumber,
  onSelectFolder,
  onSelectNote,
  onNewNote,
  onNewExcalidrawNote,
  onNewNotebookNote,
  onNewTodoNote,
  onNewFolder,
  onDeleteFolder,
  canDeleteFolder = false,
  newNoteDisabled = false,
}: Props) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  function toggleCollapse(path: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  function collapseAll() {
    const all = new Set<string>();
    function walk(nodes: FileTreeNode[]) {
      for (const n of nodes) {
        if (n.type === "folder") {
          all.add(n.path);
          walk(n.children);
        }
      }
    }
    walk(tree);
    setCollapsed(all);
  }

  function noteCountInFolder(path: string): number {
    return notes.filter((n) => (n.folder || "inbox") === path).length;
  }

  return (
    <div className="file-explorer">
      <div className="explorer-toolbar">
        <button type="button" title="新建笔记" onClick={onNewNote} disabled={newNoteDisabled}>
          📄+
        </button>
        <button
          type="button"
          title="新建 Excalidraw 笔记"
          onClick={onNewExcalidrawNote}
          disabled={newNoteDisabled}
        >
          ✏️+
        </button>
        <button
          type="button"
          title="新建 Notebook 笔记"
          onClick={onNewNotebookNote}
          disabled={newNoteDisabled}
        >
          📓+
        </button>
        <button
          type="button"
          title="新建 Todo 笔记"
          onClick={onNewTodoNote}
          disabled={newNoteDisabled}
        >
          ☑+
        </button>
        <button type="button" title="新建文件夹" onClick={onNewFolder}>
          📁+
        </button>
        <button type="button" title="折叠全部" onClick={collapseAll}>
          ⧉
        </button>
        {canDeleteFolder && activeFolder && onDeleteFolder && (
          <button type="button" title="删除空文件夹" onClick={onDeleteFolder}>
            🗑
          </button>
        )}
      </div>
      <button
        type="button"
        className={`tree-row ${activeFolder === null ? "active" : ""}`}
        onClick={() => onSelectFolder(null)}
      >
        全部笔记
      </button>
      <TreeNodes
        nodes={tree}
        depth={0}
        collapsed={collapsed}
        activeFolder={activeFolder}
        selectedNumber={selectedNumber}
        onToggle={toggleCollapse}
        onSelectFolder={onSelectFolder}
        onSelectNote={onSelectNote}
        noteCountInFolder={noteCountInFolder}
      />
    </div>
  );
}

function TreeNodes({
  nodes,
  depth,
  collapsed,
  activeFolder,
  selectedNumber,
  onToggle,
  onSelectFolder,
  onSelectNote,
  noteCountInFolder,
}: {
  nodes: FileTreeNode[];
  depth: number;
  collapsed: Set<string>;
  activeFolder: string | null;
  selectedNumber: number | null;
  onToggle: (path: string) => void;
  onSelectFolder: (path: string | null) => void;
  onSelectNote: (number: number, title: string) => void;
  noteCountInFolder: (path: string) => number;
}) {
  return (
    <>
      {nodes.map((node) => {
        if (node.type === "folder") {
          const isCollapsed = collapsed.has(node.path);
          const count = noteCountInFolder(node.path);
          return (
            <div key={node.path}>
              <button
                type="button"
                className={`tree-row ${activeFolder === node.path ? "active" : ""}`}
                style={{ paddingLeft: 8 + depth * 14 }}
                onClick={() => {
                  onToggle(node.path);
                  onSelectFolder(node.path);
                }}
              >
                <span className="tree-arrow">{isCollapsed ? "▸" : "▾"}</span>
                <span className="tree-label">{node.name}</span>
                {count > 0 && <span className="tree-badge">{count}</span>}
              </button>
              {!isCollapsed && (
                <TreeNodes
                  nodes={node.children}
                  depth={depth + 1}
                  collapsed={collapsed}
                  activeFolder={activeFolder}
                  selectedNumber={selectedNumber}
                  onToggle={onToggle}
                  onSelectFolder={onSelectFolder}
                  onSelectNote={onSelectNote}
                  noteCountInFolder={noteCountInFolder}
                />
              )}
            </div>
          );
        }
        return (
          <button
            key={node.number}
            type="button"
            className={`tree-row note ${selectedNumber === node.number ? "active" : ""} ${node.state === "closed" ? "archived" : ""}`}
            style={{ paddingLeft: 8 + depth * 14 }}
            onClick={() => onSelectNote(node.number!, node.name)}
          >
            <span className="tree-note-icon">
              {node.noteType === "excalidraw"
                ? "🖊"
                : node.noteType === "ipynb"
                  ? "📓"
                  : node.noteType === "todo"
                    ? "☑"
                    : "📄"}
            </span>
            {node.name}
          </button>
        );
      })}
    </>
  );
}
