interface Props {
  vaultLabel: string;
  saveStatus?: string;
  noteNumber?: number | null;
  shortcutHint?: string;
  onVaultClick: () => void;
}

export default function StatusBar({ vaultLabel, saveStatus, noteNumber, shortcutHint, onVaultClick }: Props) {
  return (
    <footer className="status-bar">
      <button type="button" className="status-vault" onClick={onVaultClick}>
        {vaultLabel} ▾
      </button>
      <div className="status-spacer" />
      {shortcutHint && <span className="status-shortcut-hint">{shortcutHint}</span>}
      {saveStatus && <span className="status-text">{saveStatus}</span>}
      {noteNumber != null && <span className="status-text">#{noteNumber}</span>}
    </footer>
  );
}
