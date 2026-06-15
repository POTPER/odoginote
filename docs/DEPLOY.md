# odoginote 生产环境

## 线上地址

**https://odoginote.jellyyekai.workers.dev**

健康检查：https://odoginote.jellyyekai.workers.dev/api/health

## GitHub OAuth App（必做）

打开 https://github.com/settings/developers → 你的 OAuth App → **Edit**

在 **Authorization callback URL** 中**新增**（保留 localhost 亦可）：

```
https://odoginote.jellyyekai.workers.dev/api/auth/callback
```

**Homepage URL** 可设为：

```
https://odoginote.jellyyekai.workers.dev
```

保存后，在生产站点点击「使用 GitHub 登录」即可。

## 重新部署

```powershell
cd C:\Users\odoka\Documents\GitHub\odoginote
pnpm deploy
```

## Cloudflare 资源 ID

| 资源 | ID |
|------|-----|
| D1 `odoginote-db` | `7526532e-e06d-433c-8ea1-fb1bf611a5e8` |
| KV `KV_SESSION` | `bb191b7dfd534b0aae5a65d9de405935` |
| Account ID | `c3d0c5a2fbea5377b487da2e92c1502a` |

Secrets（`GITHUB_CLIENT_ID`、`GITHUB_CLIENT_SECRET`、`SESSION_SECRET`）已通过 `wrangler secret put` 配置，不在仓库中。

## 本地开发

本地仍用 `apps/worker/.dev.vars` 中的 `APP_URL=http://localhost:5173`，`wrangler dev` 会优先读取 `.dev.vars`。
