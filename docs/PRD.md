# GiNote 产品需求文档（PRD）

> 版本：2026-06 · 状态：Living Document  
> 线上地址：https://ginote.yekai.ltd

---

## 1. 产品概述

### 1.1 定位

**GiNote** 是一款 Obsidian 风格的 Web 笔记应用。笔记以 **GitHub Issue** 形式存储在用户自有的 GitHub 仓库中，应用托管在 Cloudflare Workers，笔记正文不经过 GiNote 自有数据库。

### 1.2 目标用户

- 习惯 Markdown + 双向链接的知识工作者
- 希望笔记与 GitHub 仓库同步、可版本追溯的开发者
- 需要跨设备 Web 访问、又不想自建后端的个人用户

### 1.3 核心价值

| 价值 | 说明 |
|------|------|
| Obsidian 式体验 | 文件树、标签、图谱、分屏编辑、大纲、反向链接 |
| 数据自主 | 笔记存在用户 GitHub 仓库，可随时导出为 Markdown |
| 零运维 | Cloudflare Workers + D1/KV，无需自建服务器 |
| 渐进增强 | 浏览器扩展同步 GitHub 会话，支持图片上传到 user-attachments |

### 1.4 非目标（当前版本）

- 本地 `.md` 文件实时读写（非 GitHub Issue 模型）
- YAML frontmatter 与正文混写
- CodeMirror / WYSIWYG 富文本引擎
- 插件系统、Canvas、PDF/音视频嵌入
- 多编辑器窗格、工作区布局持久化

---

## 2. 信息架构

```
GiNote
├── 认证
│   └── GitHub OAuth 登录
├── Vault（仓库）
│   ├── 创建 / 绑定 GitHub 仓库
│   └── 多 Vault 切换
├── 笔记
│   ├── 文件夹树（.odoginote/folders.json）
│   ├── Issue 标签 odoginote:note
│   ├── 标题 / 正文 / 文件夹 / 标签 / 归档状态
│   └── 今日笔记（daily/ + daily 字段）
├── 编辑器
│   ├── 编辑 / 分屏 / 阅读 三模式
│   ├── Wiki 链接 [[note]]
│   ├── 图片粘贴/拖拽/上传
│   └── 自动保存 + 冲突检测
├── 导航与发现
│   ├── 文件浏览、搜索、标签、图谱
│   ├── 命令面板、Quick Switcher
│   └── 大纲 / 反向链接 / 出链（右侧栏）
└── 设置
    ├── 主题、编辑器模式、大纲开关
    ├── 图片存储模式
    └── GitHub user_session 同步
```

---

## 3. 界面布局（Obsidian 式壳层）

### 3.1 区域说明

| 区域 | 宽度 | 功能 |
|------|------|------|
| 左 Ribbon | 44px 固定 | 面板切换；折叠侧栏；SVG 图标 + 激活竖条 |
| 左侧栏 | 180–480px 可调 | 文件 / 搜索 / 标签 / 图谱 / 设置 |
| 主区 | flex 1 | 标签栏 + 编辑器 |
| 右侧栏 | 160–400px 可调 | 大纲 / 反向链接 / 出链 Tab |
| 状态栏 | 28px 固定 | Vault、词数、光标、保存状态、快捷键提示 |

布局状态（宽度、折叠、右栏 Tab）持久化至 `localStorage`（`ginote.layout`）。

### 3.2 编辑器区域

```
┌─ ViewHeader ─────────────────────────────────────────┐
│ vault / folder/path    [编辑][分屏][阅读]  [图片][⋯] │
├─ 内容区 ─────────────────────────────────────────────┤
│ 内联大标题（2em）                                     │
│ Properties（折叠 chip：📁 文件夹 🏷 标签）            │
│ 格式化工具栏（编辑/分屏时）                           │
│ ┌ 源码 + 行号 ─┬─ 阅读预览（720px 居中） ─┐         │
│ │  textarea   │  Markdown + 反向链接底部   │         │
│ └─────────────┴────────────────────────────┘         │
└──────────────────────────────────────────────────────┘
```

---

## 4. 功能需求详述

### 4.1 认证与 Vault

| ID | 需求 | 优先级 | 状态 |
|----|------|--------|------|
| AUTH-01 | GitHub OAuth 登录 / 登出 | P0 | ✅ |
| AUTH-02 | 生产回调 `https://ginote.yekai.ltd/api/auth/callback` | P0 | ✅ |
| VAULT-01 | Onboarding：创建新仓库或绑定已有仓库 | P0 | ✅ |
| VAULT-02 | 多 Vault 列表与切换 | P1 | ✅ |
| VAULT-03 | 欢迎笔记 / README 初始化 | P2 | ✅ |

### 4.2 笔记 CRUD

| ID | 需求 | 优先级 | 状态 |
|----|------|--------|------|
| NOTE-01 | 新建笔记（Untitled，指定文件夹） | P0 | ✅ |
| NOTE-02 | 编辑标题、正文、文件夹、标签 | P0 | ✅ |
| NOTE-03 | 自动保存（2s 防抖） | P0 | ✅ |
| NOTE-04 | 乐观锁冲突检测（expectedUpdatedAt） | P1 | ✅ |
| NOTE-05 | 归档 / 恢复（Issue open/closed） | P1 | ✅ |
| NOTE-06 | 今日笔记快捷创建/打开 | P1 | ✅ |
| NOTE-07 | 文件夹 CRUD（层级路径 `/`） | P1 | ✅ |
| NOTE-08 | 导出 Vault 到仓库 Markdown + 图片镜像 | P2 | ✅ |

### 4.3 编辑器

| ID | 需求 | 优先级 | 状态 |
|----|------|--------|------|
| ED-01 | 三种模式：edit / split / preview | P0 | ✅ |
| ED-02 | ViewHeader 视图切换 + 面包屑 | P1 | ✅ |
| ED-03 | 内联大标题 + 可折叠 Properties | P1 | ✅ |
| ED-04 | GFM 预览（表格、任务列表等） | P0 | ✅ |
| ED-05 | Wiki 链接 `[[note]]` 补全与跳转 | P0 | ✅ |
| ED-06 | 格式化工具栏（B/I/代码/H/链接） | P1 | ✅ |
| ED-07 | 阅读视图 720px 居中排版 | P1 | ✅ |
| ED-08 | 分屏标题级滚动同步 | P2 | ✅ |
| ED-09 | 源码行号 gutter | P2 | ✅ |
| ED-10 | 预览区底部反向链接 | P1 | ✅ |

### 4.4 导航与关联

| ID | 需求 | 优先级 | 状态 |
|----|------|--------|------|
| NAV-01 | 文件树浏览 + 标签页 | P0 | ✅ |
| NAV-02 | 全文搜索 | P0 | ✅ |
| NAV-03 | 标签面板 | P1 | ✅ |
| NAV-04 | 关系图谱 | P1 | ✅ |
| NAV-05 | 命令面板（Ctrl+P） | P1 | ✅ |
| NAV-06 | Quick Switcher（Ctrl+Alt+O） | P1 | ✅ |
| NAV-07 | 右侧栏：大纲 / 反向链接 / 出链 | P1 | ✅ |
| NAV-08 | 标签固定、拖拽排序、中键关闭 | P2 | ✅ |

### 4.5 图片

| ID | 需求 | 优先级 | 状态 |
|----|------|--------|------|
| IMG-01 | 粘贴 / 拖拽 / 按钮上传 | P0 | ✅ |
| IMG-02 | 默认 GitHub user-attachments | P0 | ✅ |
| IMG-03 | 可选仓库文件存储 | P1 | ✅ |
| IMG-04 | 预览代理（OAuth / user_session / 公开） | P0 | ✅ |
| IMG-05 | 浏览器扩展一键同步 user_session | P1 | ✅ |

### 4.6 快捷键与焦点

| ID | 需求 | 优先级 | 状态 |
|----|------|--------|------|
| KEY-01 | 应用焦点门控（focus-within 才响应） | P1 | ✅ |
| KEY-02 | 浏览器冲突键改用 Ctrl+Alt+* | P1 | ✅ |
| KEY-03 | 未聚焦时状态栏/空状态提示 | P2 | ✅ |

**快捷键表**

| 操作 | 快捷键 |
|------|--------|
| 新建笔记 | Ctrl+Alt+N |
| 命令面板 | Ctrl+P |
| 快速跳转 | Ctrl+Alt+O |
| 今日笔记 | Ctrl+Alt+T |
| 搜索侧栏 | Ctrl+Shift+F |
| 立即保存 | Ctrl+S |
| 关闭标签 | Ctrl+Alt+W |
| 切换编辑模式 | Ctrl+Alt+E |
| 文件浏览 | Ctrl+Shift+E |

### 4.7 设置

| 设置项 | 选项 | 状态 |
|--------|------|------|
| 编辑器模式 | split / edit / preview | ✅ |
| 显示大纲（右侧栏） | 开 / 关 | ✅ |
| 显示归档笔记 | 开 / 关 | ✅ |
| 主题 | dark / light / system | ✅ |
| 图片存储 | github-attachments / repo | ✅ |
| GitHub 会话 | 手动粘贴 / 扩展同步 | ✅ |

---

## 5. 数据模型

### 5.1 笔记（GitHub Issue）

| 字段 | 存储位置 | 说明 |
|------|----------|------|
| number | Issue # | 主键 |
| title | Issue title | 笔记标题 |
| content | Issue body | Markdown 正文 |
| folder | Issue 元数据 / 解析 | 文件夹路径 |
| tags | Issue labels / 元数据 | 标签数组 |
| daily | 元数据 | 今日笔记日期 ISO |
| state | Issue state | open=活跃 / closed=归档 |
| updatedAt | Issue updated_at | 乐观锁 |

> 标题、文件夹、标签当前为 **UI/API 字段**，不写入正文 YAML frontmatter。

### 5.2 内部持久化（浏览器）

| Key | 内容 |
|-----|------|
| `odoginote.settings` | 编辑器模式、主题、大纲等 |
| `ginote.layout` | 侧栏宽度、折叠、右栏 Tab |
| `odoginote.tabs.{vault}` | 标签页（sessionStorage） |

### 5.3 服务端（Cloudflare）

| 资源 | 用途 |
|------|------|
| D1 | 用户、Vault、加密 user_session |
| KV | OAuth Session |
| Worker ASSETS | 前端静态资源 |

---

## 6. 版本路线图

### MVP（已交付）

- GitHub OAuth + 单 Vault
- Issue 笔记 CRUD + 文件夹树
- 分屏 Markdown 编辑 + Wiki 链接
- 搜索、标签、图谱、命令面板
- Cloudflare 部署 + 自定义域名

### v1.1（已交付）

- 多 Vault、今日笔记、标签固定
- 图片上传（user-attachments + 仓库模式）
- 浏览器扩展同步 GitHub 会话
- 焦点快捷键 + Ctrl+Alt 重映射
- Obsidian 式布局升级（三阶段）
- GiNote 品牌、生产域名 ginote.yekai.ltd

### v1.2（建议下一步）

| 功能 | 说明 |
|------|------|
| 文件树内重命名/移动笔记 | 拖拽或右键菜单 |
| Properties 表格 UI | 类 Obsidian key-value 展示 |
| 自定义快捷键 | 基于 `shortcuts.ts` 扩展 |
| 移动端侧栏抽屉 | 替代当前隐藏侧栏 |
| PWA / 安装到桌面 | 减少浏览器快捷键冲突 |

### 未来（Backlog）

- YAML frontmatter 双向同步（需迁移策略）
- CodeMirror 6 源码模式（折叠、Vim）
- 实时协作 / 评论
- 模板库、书签/星标
- 插件 API
- 独立桌面壳（Tauri/Electron）

---

## 7. 非功能需求

| 类别 | 要求 |
|------|------|
| 性能 | Worker 冷启动 < 50ms；编辑器输入无明显卡顿 |
| 安全 | Session 加密存储；Secrets 不入库；OAuth state 校验 |
| 可用性 | 自动保存；冲突提示；图片上传失败引导连接 session |
| 兼容 | Chrome/Edge 最新版；Mac 上 metaKey 等同 ctrlKey |
| 可维护 | 共享类型 `@odoginote/shared`；快捷键/布局集中配置 |

---

## 8. 验收标准（Obsidian 格局升级）

- [ ] 打开笔记：ViewHeader（面包屑 + 视图切换），无旧式独立标题栏
- [ ] 大标题在内容区顶部，edit/split/preview 均可见
- [ ] Properties 默认折叠 chip，展开可编辑文件夹/标签
- [ ] 阅读/分屏预览 720px 居中，排版优于全宽平铺
- [ ] 反向链接在预览底部，不占编辑区上方
- [ ] 视图切换与 Ctrl+Alt+E、设置页同步
- [ ] 侧栏/右栏可拖拽调宽、可折叠，状态持久化
- [ ] 右侧栏大纲/反向链接/出链 Tab 正常
- [ ] 分屏滚动同步、行号、状态栏词数/光标
- [ ] 保存、Wiki 链接、图片粘贴不退化

---

## 9. 相关文档

- [部署说明](./DEPLOY.md)
- [项目 README](../README.md)
- [浏览器扩展](../apps/extension/README.md)

---

## 10. 术语表

| 术语 | 含义 |
|------|------|
| Vault | 一个 GitHub 仓库，存放该用户的所有笔记 Issue |
| Wiki 链接 | `[[笔记标题]]` 形式的双向链接语法 |
| user_session | GitHub 网页登录 Cookie，用于 user-attachments 图片访问 |
| Properties | 笔记元数据（文件夹、标签等），Obsidian 式折叠展示 |
| 归档 | 将 Issue 设为 closed，默认从文件树隐藏 |
