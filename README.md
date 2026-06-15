# GiNote

Obsidian 式笔记 Web 应用，数据存在你自己的 GitHub 仓库（Issue 形式）。

## 快速开始

### 1. 创建 GitHub OAuth App

1. 打开 [GitHub Developer Settings → OAuth Apps → New](https://github.com/settings/applications/new)
2. **Application name**: odoginote (local)
3. **Homepage URL**: `http://localhost:5173`
4. **Authorization callback URL**: `http://localhost:5173/api/auth/callback`
5. 记下 **Client ID** 和 **Client Secret**

### 2. 配置环境变量

在项目根目录执行（PowerShell）：

```powershell
Copy-Item apps\worker\.dev.vars.example apps\worker\.dev.vars
```

若提示找不到文件，可直接编辑已生成的 `apps\worker\.dev.vars`（内容与 `.dev.vars.example` 相同）。

> Windows 资源管理器默认隐藏以 `.` 开头的文件；在 VS Code / Cursor 左侧文件树中可直接打开 `apps/worker/.dev.vars`。

编辑 `apps/worker/.dev.vars`：

```
GITHUB_CLIENT_ID=你的ClientID
GITHUB_CLIENT_SECRET=你的ClientSecret
SESSION_SECRET=随机长字符串
APP_URL=http://localhost:5173
```

> 注意：`GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` 只写在 `.dev.vars` 里，不要放进 `wrangler.jsonc` 的 `vars`（空字符串会覆盖 `.dev.vars`）。修改后需重启 `pnpm dev`。

### 3. 安装依赖并启动

```bash
pnpm install
pnpm --filter @odoginote/shared build
pnpm --filter @odoginote/worker db:migrate:local
pnpm dev
```

- 前端: http://localhost:5173
- Worker API: http://localhost:8787

### 4. 使用

1. 点击「使用 GitHub 登录」
2. 新建或选择笔记仓库
3. 开始写笔记 — 每条笔记 = 一个 GitHub Issue

## 登录报 403 排查

1. **Callback URL 必须完全一致**（不能写 127.0.0.1，要用 localhost）：
   ```
   http://localhost:5173/api/auth/callback
   ```
2. **Homepage URL** 填 `http://localhost:5173`
3. 确认 `.dev.vars` 里的 `APP_URL=http://localhost:5173`
4. 修改 OAuth App 或 `.dev.vars` 后，**重启** `pnpm dev`
5. 若仍失败，在 GitHub OAuth App 页面 **Generate a new client secret**，更新到 `.dev.vars`

## 架构

- **前端**: React + Vite
- **后端**: Cloudflare Worker + Hono
- **存储**: GitHub Issues（label: `odoginote:note`）
- **元数据**: Issue body 顶部 YAML frontmatter（folder、tags）

## 部署

生产环境说明见 [docs/DEPLOY.md](docs/DEPLOY.md)。

**线上地址**：https://odoginote.jellyyekai.workers.dev

```bash
pnpm build
pnpm --filter @odoginote/worker deploy
```

生产环境需更新 GitHub OAuth App callback URL 和 `APP_URL`（见 DEPLOY.md）。
