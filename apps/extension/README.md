# odoginote 浏览器扩展 — GitHub 会话同步

将 GitHub 的 `user_session` Cookie 一键同步到 odoginote，用于 **GitHub 附件** 模式的图片上传与预览，无需打开 DevTools 手动复制。

## 安装（Chrome / Edge）

1. 打开 `chrome://extensions`（Edge 为 `edge://extensions`）
2. 开启右上角 **开发者模式**
3. 点击 **加载已解压的扩展程序**
4. 选择本仓库目录：`apps/extension`

## 使用

1. 在同一浏览器中登录 [github.com](https://github.com)
2. 登录 [odoginote](https://odoginote.jellyyekai.workers.dev)（或本地 `http://localhost:5173`）
3. 打开 **设置 → GitHub 图片会话**
4. 点击 **一键同步 GitHub 会话**

也可点击浏览器工具栏中的扩展图标，在弹出窗口中触发同步（需已打开 odoginote 标签页）。

## 本地开发

扩展 `manifest.json` 已包含 `http://localhost:5173/*`，与 Vite 开发服务器配合使用。

## 权限说明

| 权限 | 用途 |
|------|------|
| `cookies` | 读取 `github.com` 的 `user_session`（仅用户点击同步时） |
| `scripting` / `tabs` | 扩展弹窗向 odoginote 页面发送同步消息 |

Cookie **不会**写入扩展存储，**不会**发送到除 odoginote API 以外的第三方。

## 手动备用

若未安装扩展，仍可在设置页展开 **手动粘贴 user_session** 进行连接。

## 文件结构

```
apps/extension/
  manifest.json          # MV3 配置
  background.js          # 读取 GitHub Cookie
  content-odoginote.js   # 注入 odoginote 页面，调用 API
  popup.html / popup.js  # 扩展图标弹窗
```
