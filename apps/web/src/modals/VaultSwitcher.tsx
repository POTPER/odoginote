import { useEffect, useState } from "react";
import type { UserInfo, VaultSummary } from "@odoginote/shared";
import { api } from "../lib/api";

interface Props {
  open: boolean;
  user: UserInfo;
  onClose: () => void;
  onSwitched: () => void;
}

export default function VaultSwitcher({ open, user, onClose, onSwitched }: Props) {
  const [mode, setMode] = useState<"list" | "create" | "existing">("list");
  const [repos, setRepos] = useState<Array<{ fullName: string; owner: string; name: string }>>([]);
  const [repoName, setRepoName] = useState("ginote");
  const [selected, setSelected] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open && mode === "existing") {
      api.listRepos().then(setRepos).catch(() => setError("无法加载仓库"));
    }
  }, [open, mode]);

  if (!open) return null;

  async function handleSwitch(v: VaultSummary) {
    setLoading(true);
    try {
      await api.switchVault(v.owner, v.repo);
      onSwitched();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "切换失败");
    } finally {
      setLoading(false);
    }
  }

  async function handleSetup() {
    setLoading(true);
    setError("");
    try {
      if (mode === "create") {
        await api.setupVault({ mode: "create", repoName });
      } else {
        const [owner, repo] = selected.split("/");
        if (!owner || !repo) throw new Error("请选择仓库");
        await api.setupVault({ mode: "existing", owner, repo });
      }
      onSwitched();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "设置失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal vault-switcher" onClick={(e) => e.stopPropagation()}>
        <h2>Vault 切换</h2>

        {mode === "list" && (
          <>
            <ul className="vault-switch-list">
              {user.vaults.map((v) => (
                <li key={v.id}>
                  <button type="button" onClick={() => handleSwitch(v)} disabled={loading}>
                    {v.owner}/{v.repo}
                    {user.activeVault?.owner === v.owner && user.activeVault?.repo === v.repo && (
                      <span className="badge">当前</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setMode("create")}>
                新建 Vault
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setMode("existing")}>
                绑定已有仓库
              </button>
            </div>
          </>
        )}

        {mode === "create" && (
          <>
            <label className="modal-label">
              仓库名称
              <input value={repoName} onChange={(e) => setRepoName(e.target.value)} />
            </label>
            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setMode("list")}>
                返回
              </button>
              <button type="button" className="btn" onClick={handleSetup} disabled={loading}>
                创建
              </button>
            </div>
          </>
        )}

        {mode === "existing" && (
          <>
            <select value={selected} onChange={(e) => setSelected(e.target.value)} className="modal-select">
              <option value="">-- 选择仓库 --</option>
              {repos.map((r) => (
                <option key={r.fullName} value={r.fullName}>
                  {r.fullName}
                </option>
              ))}
            </select>
            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setMode("list")}>
                返回
              </button>
              <button type="button" className="btn" onClick={handleSetup} disabled={loading}>
                绑定
              </button>
            </div>
          </>
        )}

        {error && <p className="modal-error">{error}</p>}
      </div>
    </div>
  );
}
