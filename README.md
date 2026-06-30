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

GiNote 部署在 **Cloudflare Workers** 上：Worker 同时提供 API 与静态前端（`apps/web/dist`），无需单独托管前端。

**生产地址**：https://ginote.yekai.ltd  
**Workers 备用地址**：https://odoginote.jellyyekai.workers.dev  
**健康检查**：`/api/health`

### 前置条件

- [Node.js](https://nodejs.org/) 18+ 与 [pnpm](https://pnpm.io/)
- [Cloudflare](https://dash.cloudflare.com/) 账号
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) 已登录：`pnpm exec wrangler login`

### 首次部署（新环境）

#### 1. 创建 Cloudflare 资源

```bash
# D1 数据库
pnpm exec wrangler d1 create odoginote-db

# KV 命名空间（会话存储）
pnpm exec wrangler kv namespace create KV_SESSION
```

将返回的 `database_id` 与 KV `id` 写入 `apps/worker/wrangler.jsonc` 的 `d1_databases` / `kv_namespaces`，并填入你的 `account_id`。

#### 2. 配置生产环境变量

在 `apps/worker/wrangler.jsonc` 的 `vars` 中设置对外访问地址（须与 OAuth 回调域名一致）：

```jsonc
"vars": {
  "APP_URL": "https://ginote.yekai.ltd"
}
```

若使用自定义域名，在 `routes` 中添加对应 `pattern` 并在 Cloudflare 控制台绑定域名。

#### 3. 配置 Secrets

以下敏感信息**不要**写入仓库，通过 Wrangler 注入：

```bash
cd apps/worker
pnpm exec wrangler secret put GITHUB_CLIENT_ID
pnpm exec wrangler secret put GITHUB_CLIENT_SECRET
pnpm exec wrangler secret put SESSION_SECRET
```

`SESSION_SECRET` 建议使用 32 字节以上随机字符串。

#### 4. 创建 GitHub OAuth App（生产）

1. 打开 [GitHub Developer Settings → OAuth Apps → New](https://github.com/settings/applications/new)
2. **Homepage URL**：`https://ginote.yekai.ltd`（或你的 `APP_URL`）
3. **Authorization callback URL**：
   ```
   https://ginote.yekai.ltd/api/auth/callback
   ```
4. 将 **Client ID** / **Client Secret** 写入上一步的 Wrangler Secrets

本地开发可保留 `http://localhost:5173/api/auth/callback` 作为额外回调地址。

#### 5. 执行数据库迁移

```bash
pnpm --filter @odoginote/worker db:migrate:remote
```

#### 6. 构建并部署

在项目根目录：

```bash
pnpm run deploy:prod
```

等价于 `pnpm build`（shared → web → worker）后执行 `wrangler deploy`。

> **注意**：pnpm 9 保留了内置命令 `pnpm deploy`（用于 workspace 打包），不能直接触发本项目脚本。请使用 `pnpm run deploy:prod`。

部署成功后访问 `/api/health` 确认返回正常，再在生产站点测试 GitHub 登录。

### 重新部署

代码或配置变更后，在项目根目录执行：

```bash
pnpm run deploy:prod
```

仅修改前端时也可分步执行：

```bash
pnpm build
pnpm --filter @odoginote/worker deploy
```

### 部署架构

| 组件 | 说明 |
|------|------|
| Worker (`apps/worker`) | Hono API + 静态资源（`assets.directory` → `apps/web/dist`） |
| D1 (`odoginote-db`) | 用户、Vault 元数据 |
| KV (`KV_SESSION`) | 登录会话 |
| Secrets | `GITHUB_CLIENT_ID`、`GITHUB_CLIENT_SECRET`、`SESSION_SECRET` |

### 常见问题

1. **登录 403 / redirect_uri 不匹配**  
   GitHub OAuth App 的 callback URL 必须与 `APP_URL` 完全一致（含 `https`、无多余斜杠）。

2. **本地与生产 OAuth 分离**  
   本地用 `apps/worker/.dev.vars`（`APP_URL=http://localhost:5173`）；生产用 `wrangler.jsonc` 的 `vars` 与 Secrets。不要把 Client Secret 放进 `wrangler.jsonc` 的 `vars`。

3. **数据库 schema 过期**  
   拉取含新 migration 的代码后，先执行 `pnpm --filter @odoginote/worker db:migrate:remote` 再部署。

更多运维细节见 [docs/DEPLOY.md](docs/DEPLOY.md)。
