import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";

interface Props {
  onComplete: () => void;
}

export default function OnboardingPage({ onComplete }: Props) {
  const navigate = useNavigate();
  const [repos, setRepos] = useState<Array<{ name: string; fullName: string; owner: string }>>([]);
  const [mode, setMode] = useState<"create" | "existing">("create");
  const [repoName, setRepoName] = useState("ginote");
  const [selected, setSelected] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.listRepos().then(setRepos).catch(() => setError("无法加载仓库列表"));
  }, []);

  async function handleSetup() {
    setLoading(true);
    setError("");
    try {
      if (mode === "create") {
        await api.setupVault({ mode: "create", repoName });
      } else {
        const [owner, repo] = selected.split("/");
        if (!owner || !repo) throw new Error("请选择一个仓库");
        await api.setupVault({ mode: "existing", owner, repo });
      }
      await onComplete();
      navigate("/vault");
    } catch (e) {
      setError(e instanceof Error ? e.message : "设置失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="onboarding-page">
      <h1 className="onboarding-page__title">设置笔记仓库</h1>
      <p className="onboarding-page__subtitle">
        选择一个 GitHub 仓库来存放笔记。每条笔记对应一个 Issue。
      </p>

      <div className="segmented-control">
        <button
          className={mode === "create" ? "btn" : "btn btn-ghost"}
          onClick={() => setMode("create")}
        >
          新建仓库
        </button>
        <button
          className={mode === "existing" ? "btn" : "btn btn-ghost"}
          onClick={() => setMode("existing")}
        >
          使用已有仓库
        </button>
      </div>

      {mode === "create" ? (
        <label className="form-field">
          <span className="form-field__label">仓库名称</span>
          <input
            value={repoName}
            onChange={(e) => setRepoName(e.target.value)}
            placeholder="ginote"
          />
        </label>
      ) : (
        <label className="form-field">
          <span className="form-field__label">选择仓库</span>
          <select value={selected} onChange={(e) => setSelected(e.target.value)}>
            <option value="">-- 选择 --</option>
            {repos.map((r) => (
              <option key={r.fullName} value={r.fullName}>
                {r.fullName}
              </option>
            ))}
          </select>
        </label>
      )}

      {error && <p className="form-error">{error}</p>}

      <button className="btn" onClick={handleSetup} disabled={loading} style={{ width: "100%" }}>
        {loading ? "设置中..." : "开始使用"}
      </button>
    </div>
  );
}
