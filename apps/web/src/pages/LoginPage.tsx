import { loginWithGitHub } from "../lib/api";

export default function LoginPage() {
  return (
    <div
      style={{
        minHeight: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        textAlign: "center",
        gap: 24,
      }}
    >
      <div>
        <h1 style={{ fontSize: 48, fontWeight: 700, color: "#fff", marginBottom: 8 }}>GiNote</h1>
        <p style={{ color: "var(--text-muted)", maxWidth: 420 }}>
          Obsidian 式笔记体验，数据存在你自己的 GitHub 仓库里。登录即可开始。
        </p>
      </div>
      <button className="btn" onClick={loginWithGitHub} style={{ fontSize: 16, padding: "12px 24px" }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.395-.135-.345-.72-1.395-1.23-1.875-.42-.45-1.02-.78 0-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.375 1.23-3.215-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.215 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
        </svg>
        使用 GitHub 登录
      </button>
      <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
        笔记以 Issue 形式存储在你选定的仓库中，我们不会保存笔记内容。
      </p>
    </div>
  );
}
