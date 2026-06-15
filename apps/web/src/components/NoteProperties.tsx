import { useState } from "react";

interface Props {
  folder: string;
  folders: string[];
  tagsStr: string;
  updatedAt?: string;
  onFolderChange: (folder: string) => void;
  onTagsChange: (tags: string) => void;
}

export default function NoteProperties({
  folder,
  folders,
  tagsStr,
  updatedAt,
  onFolderChange,
  onTagsChange,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const tags = tagsStr
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  return (
    <div className={`note-properties${expanded ? " expanded" : ""}`}>
      <button type="button" className="note-properties-toggle" onClick={() => setExpanded((v) => !v)}>
        <span className="note-properties-chips">
          <span className="prop-chip">📁 {folder || "inbox"}</span>
          {tags.length > 0 ? (
            <span className="prop-chip">🏷 {tags.join(", ")}</span>
          ) : (
            <span className="prop-chip muted">无标签</span>
          )}
        </span>
        <span className="note-properties-chevron">{expanded ? "▾" : "▸"}</span>
      </button>

      {expanded && (
        <div className="note-properties-form">
          <label>
            <span>文件夹</span>
            <select value={folder} onChange={(e) => onFolderChange(e.target.value)}>
              {folders.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>标签</span>
            <input
              value={tagsStr}
              onChange={(e) => onTagsChange(e.target.value)}
              placeholder="idea, draft"
            />
          </label>
          {updatedAt && (
            <p className="prop-readonly">更新于 {new Date(updatedAt).toLocaleString()}</p>
          )}
        </div>
      )}
    </div>
  );
}
