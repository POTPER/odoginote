import type { EditorMode, ImageStorage, ThemeMode, UserInfo, VaultSummary } from "@odoginote/shared";
import { useEffect, useState } from "react";
import { api, logout } from "../lib/api";
import type { UiStyle } from "../hooks/useAppState";
import { isExtensionInstalled, syncGitHubSessionViaExtension } from "../lib/extension-bridge";
import {
  loadJupyterConfig,
  saveJupyterConfig,
  type JupyterConnectionConfig,
} from "../lib/kernel-runner";

interface Props {
  variant?: "sidebar" | "modal";
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

export default function SettingsPanel({
  variant = "sidebar",
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
  const [sessionConnected, setSessionConnected] = useState(false);
  const [sessionUpdatedAt, setSessionUpdatedAt] = useState<string | null>(null);
  const [sessionInput, setSessionInput] = useState("");
  const [sessionBusy, setSessionBusy] = useState(false);
  const [sessionError, setSessionError] = useState("");
  const [sessionSuccess, setSessionSuccess] = useState("");
  const [showManualSession, setShowManualSession] = useState(false);
  const [extensionReady, setExtensionReady] = useState(false);
  const [exportStatus, setExportStatus] = useState("");
  const [jupyterConfig, setJupyterConfig] = useState<JupyterConnectionConfig>(() => loadJupyterConfig());

  useEffect(() => {
    api.getGitHubSession().then((s) => {
      setSessionConnected(s.connected);
      setSessionUpdatedAt(s.updatedAt);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    setExtensionReady(isExtensionInstalled());
    const timer = window.setInterval(() => {
      setExtensionReady(isExtensionInstalled());
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  async function handleRemoveVault(v: VaultSummary) {
    if (!confirm(`解除绑定 ${v.owner}/${v.repo}？（不会删除 GitHub 仓库）`)) return;
    await api.deleteVault(v.id);
    onVaultChange();
  }

  async function handleConnectSession() {
    if (!sessionInput.trim()) return;
    setSessionBusy(true);
    setSessionError("");
    setSessionSuccess("");
    try {
      const res = await api.saveGitHubSession(sessionInput.trim());
      setSessionConnected(res.connected);
      setSessionUpdatedAt(res.updatedAt);
      setSessionInput("");
      setSessionSuccess("会话已连接");
    } catch (e) {
      setSessionError(e instanceof Error ? e.message : "连接失败");
    } finally {
      setSessionBusy(false);
    }
  }

  async function handleExtensionSync() {
    setSessionBusy(true);
    setSessionError("");
    setSessionSuccess("");
    try {
      const res = await syncGitHubSessionViaExtension();
      if (!res.ok) {
        if (res.code === "NOT_LOGGED_IN") {
          setSessionError("请先在浏览器中登录 github.com，然后重试");
        } else if (res.code === "EXTENSION_NOT_INSTALLED") {
          setSessionError("扩展未安装，请按下方说明加载 apps/extension");
        } else {
          setSessionError(res.error || "同步失败");
        }
        return;
      }
      setSessionConnected(Boolean(res.connected));
      setSessionUpdatedAt(res.updatedAt ?? new Date().toISOString());
      setSessionSuccess("GitHub 会话已通过扩展同步");
    } finally {
      setSessionBusy(false);
    }
  }

  async function handleDisconnectSession() {
    setSessionBusy(true);
    setSessionSuccess("");
    try {
      await api.deleteGitHubSession();
      setSessionConnected(false);
      setSessionUpdatedAt(null);
    } finally {
      setSessionBusy(false);
    }
  }

  async function handleExport() {
    setExportStatus("导出中...");
    try {
      const res = await api.exportVault();
      setExportStatus(
        `已导出 ${res.noteCount} 篇笔记，镜像 ${res.mirroredAttachments} 张图片` +
          (res.skippedAttachments.length > 0
            ? `，跳过 ${res.skippedAttachments.length} 张外链`
            : "")
      );
    } catch (e) {
      setExportStatus(e instanceof Error ? e.message : "导出失败");
    }
  }

  const showSessionGuide =
    imageStorage === "github-attachments" && !sessionConnected && !sessionBusy;

  return (
    <div className={`settings-panel${variant === "modal" ? " settings-panel--modal" : ""}`}>
      {variant === "sidebar" && <div className="panel-header">设置</div>}

      {showSessionGuide && (
        <div className="settings-guide">
          GitHub 附件模式需要同步浏览器会话才能上传/预览图片。
          {extensionReady ? " 点击下方按钮一键同步。" : " 请先安装浏览器扩展。"}
        </div>
      )}

      <section className="settings-section">
        <h3>编辑器</h3>
        <label className="settings-row">
          模式
          <select
            value={editorMode}
            onChange={(e) => onEditorModeChange(e.target.value as EditorMode)}
          >
            <option value="split">分屏</option>
            <option value="edit">仅编辑</option>
            <option value="preview">仅预览</option>
          </select>
        </label>
        <label className="settings-row">
          显示已归档笔记
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => onShowArchivedChange(e.target.checked)}
          />
        </label>
        <label className="settings-row">
          显示大纲面板
          <input
            type="checkbox"
            checked={showOutline}
            onChange={(e) => onShowOutlineChange(e.target.checked)}
          />
        </label>
        <label className="settings-row">
          图片存储
          <select
            value={imageStorage}
            onChange={(e) => onImageStorageChange(e.target.value as ImageStorage)}
          >
            <option value="github-attachments">GitHub 附件（默认）</option>
            <option value="repo">仓库文件</option>
          </select>
        </label>
      </section>

      <section className="settings-section">
        <h3>GitHub 图片会话</h3>
        <p className="panel-muted">
          状态：{sessionConnected ? "已连接" : "未连接"}
          {sessionUpdatedAt && `（${new Date(sessionUpdatedAt).toLocaleString()}）`}
        </p>
        <p className="panel-muted">
          扩展：{extensionReady ? "已安装" : "未检测到"}
        </p>

        {extensionReady ? (
          <p className="panel-muted settings-hint">
            请确保已在同一浏览器登录 github.com，然后点击一键同步。
          </p>
        ) : (
          <p className="panel-muted settings-hint">
            安装扩展：打开 chrome://extensions → 开发者模式 → 加载已解压的扩展程序 →
            选择仓库内 <code>apps/extension</code> 目录。详见该目录 README.md。
          </p>
        )}

        <div className="settings-actions">
          {!sessionConnected && extensionReady && (
            <button
              type="button"
              className="btn settings-btn"
              disabled={sessionBusy}
              onClick={() => void handleExtensionSync()}
            >
              一键同步 GitHub 会话
            </button>
          )}
          {sessionConnected ? (
            <button
              type="button"
              className="btn btn-ghost settings-btn"
              disabled={sessionBusy}
              onClick={() => void handleDisconnectSession()}
            >
              解除会话
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-ghost settings-btn"
              disabled={sessionBusy}
              onClick={() => setShowManualSession((v) => !v)}
            >
              {showManualSession ? "收起手动粘贴" : "手动粘贴 user_session"}
            </button>
          )}
        </div>

        {!sessionConnected && showManualSession && (
          <>
            <p className="panel-muted settings-hint">
              DevTools → Application → Cookies → github.com → 复制 <code>user_session</code>
            </p>
            <label className="settings-row settings-row-block">
              user_session
              <input
                type="password"
                value={sessionInput}
                onChange={(e) => setSessionInput(e.target.value)}
                placeholder="粘贴 user_session 值"
              />
            </label>
            <button
              type="button"
              className="btn settings-btn"
              disabled={sessionBusy || !sessionInput.trim()}
              onClick={() => void handleConnectSession()}
            >
              连接会话
            </button>
          </>
        )}

        {sessionError && <p className="form-error">{sessionError}</p>}
        {sessionSuccess && <p className="form-success">{sessionSuccess}</p>}
      </section>

      <section className="settings-section">
        <h3>Jupyter 连接（即将支持）</h3>
        <p className="panel-muted settings-hint">
          在 conda 环境中启动本地 Jupyter（如 jupyter lab --no-browser --port=8888），
          未来将通过浏览器扩展连接以运行 Notebook 代码单元。
        </p>
        <label className="settings-row settings-row-block">
          Server URL
          <input
            type="url"
            value={jupyterConfig.baseUrl}
            onChange={(e) => {
              const next = { ...jupyterConfig, baseUrl: e.target.value };
              setJupyterConfig(next);
              saveJupyterConfig(next);
            }}
            placeholder="http://127.0.0.1:8888"
          />
        </label>
        <label className="settings-row settings-row-block">
          Token（可选）
          <input
            type="password"
            value={jupyterConfig.token ?? ""}
            onChange={(e) => {
              const next = { ...jupyterConfig, token: e.target.value || undefined };
              setJupyterConfig(next);
              saveJupyterConfig(next);
            }}
            placeholder="Jupyter token"
          />
        </label>
        <label className="settings-row settings-row-block">
          Kernel 名称（conda 环境）
          <input
            type="text"
            value={jupyterConfig.kernelName ?? ""}
            onChange={(e) => {
              const next = { ...jupyterConfig, kernelName: e.target.value || undefined };
              setJupyterConfig(next);
              saveJupyterConfig(next);
            }}
            placeholder="python3"
          />
        </label>
      </section>

      <section className="settings-section">
        <h3>外观</h3>
        <label className="settings-row">
          主题
          <select value={theme} onChange={(e) => onThemeChange(e.target.value as ThemeMode)}>
            <option value="dark">深色</option>
            <option value="light">浅色</option>
            <option value="system">跟随系统</option>
          </select>
        </label>
        <label className="settings-row">
          UI 样式
          <select value={uiStyle} onChange={(e) => onUiStyleChange(e.target.value as UiStyle)}>
            <option value="beautiful">美观（默认）</option>
            <option value="compact">效率简洁</option>
          </select>
        </label>
        <p className="panel-muted settings-hint">
          效率简洁模式去掉阴影、模糊与动画，布局与功能不变。
        </p>
      </section>

      <section className="settings-section">
        <h3>导出</h3>
        <p className="panel-muted settings-hint">
          将笔记导出为 vault/*.md，并将 user-attachments 图片镜像到 vault/assets/。
        </p>
        <button type="button" className="btn settings-btn" onClick={() => void handleExport()}>
          导出到仓库
        </button>
        {exportStatus && <p className="panel-muted">{exportStatus}</p>}
      </section>

      <section className="settings-section">
        <h3>账户</h3>
        <p className="panel-muted">GitHub: {user.login}</p>
        <button type="button" className="btn btn-ghost settings-btn" onClick={() => logout()}>
          退出登录
        </button>
      </section>

      <section className="settings-section">
        <h3>Vault 管理</h3>
        <button type="button" className="btn settings-btn" onClick={onOpenVaultSwitcher}>
          切换 / 添加 Vault
        </button>
        <ul className="vault-list">
          {user.vaults.map((v) => (
            <li key={v.id} className="vault-list-item">
              <span>
                {v.owner}/{v.repo}
              </span>
              <button type="button" className="link-btn" onClick={() => handleRemoveVault(v)}>
                解除
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
