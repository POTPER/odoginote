import { useEffect, useRef, useState } from "react";
import type { NoteType } from "@odoginote/shared";
import type { EditorMode } from "../types/ui";

interface Props {
  folder: string;
  vaultName?: string;
  noteType?: NoteType;
  editorMode: EditorMode;
  onEditorModeChange: (mode: EditorMode) => void;
  onNavigateFolder: (folder: string) => void;
  onInsertImage: () => void;
  onArchive: () => void;
  isArchived: boolean;
  imageUploadDisabled?: boolean;
}

const MODES: { id: EditorMode; label: string; title: string }[] = [
  { id: "edit", label: "编辑", title: "编辑模式" },
  { id: "split", label: "分屏", title: "分屏模式" },
  { id: "preview", label: "阅读", title: "阅读模式" },
];

export default function ViewHeader({
  folder,
  vaultName,
  noteType,
  editorMode,
  onEditorModeChange,
  onNavigateFolder,
  onInsertImage,
  onArchive,
  isArchived,
  imageUploadDisabled,
}: Props) {
  const isStructuredNote = noteType === "excalidraw" || noteType === "ipynb" || noteType === "todo";
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onDocClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [menuOpen]);

  const segments = folder.split("/").filter(Boolean);
  if (segments.length === 0) segments.push("inbox");

  return (
    <header className="view-header">
      <nav className="view-breadcrumb" aria-label="路径">
        {vaultName && (
          <>
            <span className="view-breadcrumb-vault">{vaultName}</span>
            <span className="view-breadcrumb-sep">/</span>
          </>
        )}
        {segments.map((seg, i) => {
          const path = segments.slice(0, i + 1).join("/");
          return (
            <span key={path} className="view-breadcrumb-segment">
              {i > 0 && <span className="view-breadcrumb-sep">/</span>}
              <button type="button" className="view-breadcrumb-link" onClick={() => onNavigateFolder(path)}>
                {seg}
              </button>
            </span>
          );
        })}
      </nav>

      <div className="view-header-actions">
        {!isStructuredNote && (
          <div className="view-mode-toggle" role="group" aria-label="视图模式">
            {MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                className={`view-mode-btn${editorMode === m.id ? " active" : ""}`}
                title={m.title}
                onClick={() => onEditorModeChange(m.id)}
              >
                {m.label}
              </button>
            ))}
          </div>
        )}

        {!isStructuredNote && (
          <button
            type="button"
            className="view-action-btn"
            title="插入图片"
            disabled={imageUploadDisabled}
            onClick={onInsertImage}
          >
            图片
          </button>
        )}

        <div className="view-more-menu" ref={menuRef}>
          <button
            type="button"
            className="view-action-btn"
            title="更多操作"
            onClick={() => setMenuOpen((v) => !v)}
          >
            ⋯
          </button>
          {menuOpen && (
            <div className="view-more-dropdown">
              <button
                type="button"
                onClick={() => {
                  onArchive();
                  setMenuOpen(false);
                }}
              >
                {isArchived ? "恢复笔记" : "归档笔记"}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
