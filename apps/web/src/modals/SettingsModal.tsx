import SettingsPanel from "../panels/SettingsPanel";
import type { SettingsBundle } from "../types/settings";

interface Props {
  open: boolean;
  onClose: () => void;
  bundle: SettingsBundle;
}

export default function SettingsModal({ open, onClose, bundle }: Props) {
  const { settings, updateSettings, user, onVaultChange, onOpenVaultSwitcher } = bundle;

  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal settings-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal-head">
          <div>
            <h2 id="settings-title">设置</h2>
            <p className="modal-subtitle">管理编辑器、Vault 与账号偏好</p>
          </div>
          <button type="button" className="modal-close" aria-label="关闭" onClick={onClose}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </header>
        <div className="modal-body">
          <SettingsPanel
            variant="modal"
            user={user}
            editorMode={settings.editorMode}
            onEditorModeChange={(mode) => updateSettings({ editorMode: mode })}
            showArchived={settings.showArchived}
            onShowArchivedChange={(value) => updateSettings({ showArchived: value })}
            theme={settings.theme}
            onThemeChange={(theme) => updateSettings({ theme })}
            uiStyle={settings.uiStyle}
            onUiStyleChange={(style) => updateSettings({ uiStyle: style })}
            showOutline={settings.showOutline}
            onShowOutlineChange={(value) => updateSettings({ showOutline: value })}
            imageStorage={settings.imageStorage}
            onImageStorageChange={(value) => updateSettings({ imageStorage: value })}
            onVaultChange={onVaultChange}
            onOpenVaultSwitcher={onOpenVaultSwitcher}
          />
        </div>
      </div>
    </div>
  );
}
