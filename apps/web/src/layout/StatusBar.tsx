interface Props {
  vaultLabel: string;
  saveStatus?: string;
  noteNumber?: number | null;
  noteType?: "markdown" | "excalidraw" | "ipynb";
  shortcutHint?: string;
  wordCount?: number;
  cursorLine?: number;
  cursorCol?: number;
  onVaultClick: () => void;
}

export default function StatusBar({
  vaultLabel,
  saveStatus,
  noteNumber,
  noteType,
  shortcutHint,
  wordCount,
  cursorLine,
  cursorCol,
  onVaultClick,
}: Props) {
  const isExcalidraw = noteType === "excalidraw";
  const isNotebook = noteType === "ipynb";
  const isStructured = isExcalidraw || isNotebook;

  return (
    <footer className="status-bar">
      <button type="button" className="status-vault" onClick={onVaultClick}>
        {vaultLabel} ▾
      </button>
      <div className="status-spacer" />
      {shortcutHint && <span className="status-shortcut-hint">{shortcutHint}</span>}
      {wordCount != null && isExcalidraw && (
        <span className="status-text">{wordCount} 元素</span>
      )}
      {wordCount != null && isNotebook && (
        <span className="status-text">{wordCount} 单元格</span>
      )}
      {wordCount != null && !isStructured && cursorLine != null && cursorCol != null && (
        <span className="status-text">
          {wordCount} 词 · 行 {cursorLine} 列 {cursorCol}
        </span>
      )}
      {saveStatus && <span className="status-text">{saveStatus}</span>}
      {noteNumber != null && <span className="status-text">#{noteNumber}</span>}
    </footer>
  );
}
