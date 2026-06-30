import type { EditorMode, ImageStorage, ThemeMode, UserInfo } from "@odoginote/shared";
import type { UiStyle } from "../hooks/useAppState";
import SettingsPanel from "../panels/SettingsPanel";

interface Props {
  open: boolean;
  onClose: () => void;
  user: UserInfo;
  editorMode: EditorMode;
  onEditorModeChange: (mode: EditorMode) => void;
  showArchived: boolean;
  onShowArchivedChange: (value: boolean) => void;
  theme: ThemeMode;
  onThemeChange: (theme: ThemeMode) => void;
  uiStyle: UiStyle;
  onUiStyleChange: (style: UiStyle) => void;
  showOutline: boolean;
  onShowOutlineChange: (value: boolean) => void;
  imageStorage: ImageStorage;
  onImageStorageChange: (value: ImageStorage) => void;
  onVaultChange: () => void;
  onOpenVaultSwitcher: () => void;
}

export default function SettingsModal({
  open,
  onClose,
  user,
  editorMode,
  onEditorModeChange,
  showArchived,
  onShowArchivedChange,
  theme,
  onThemeChange,
  uiStyle,
  onUiStyleChange,
  showOutline,
  onShowOutlineChange,
  imageStorage,
  onImageStorageChange,
  onVaultChange,
  onOpenVaultSwitcher,
}: Props) {
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
            editorMode={editorMode}
            onEditorModeChange={onEditorModeChange}
            showArchived={showArchived}
            onShowArchivedChange={onShowArchivedChange}
            theme={theme}
            onThemeChange={onThemeChange}
            uiStyle={uiStyle}
            onUiStyleChange={onUiStyleChange}
            showOutline={showOutline}
            onShowOutlineChange={onShowOutlineChange}
            imageStorage={imageStorage}
            onImageStorageChange={onImageStorageChange}
            onVaultChange={onVaultChange}
            onOpenVaultSwitcher={onOpenVaultSwitcher}
          />
        </div>
      </div>
    </div>
  );
}
