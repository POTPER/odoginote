import type { JupyterConnectionConfig } from "./kernel-runner";

const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost", "::1"]);

export function isLocalJupyterUrl(baseUrl: string): boolean {
  try {
    const url = new URL(baseUrl);
    return LOCAL_HOSTS.has(url.hostname.toLowerCase());
  } catch {
    return /127\.0\.0\.1|localhost|::1/i.test(baseUrl);
  }
}

export function getAppOrigin(): string {
  if (typeof window === "undefined") return "";
  return window.location.origin;
}

export function isProductionRemoteAccess(baseUrl: string): boolean {
  if (typeof window === "undefined") return false;
  const origin = getAppOrigin();
  if (!origin) return false;
  const isLocalApp =
    origin.startsWith("http://localhost:") ||
    origin.startsWith("http://127.0.0.1:") ||
    import.meta.env.DEV;
  return !isLocalApp && isLocalJupyterUrl(baseUrl);
}

export function getJupyterSetupSnippet(origin?: string): string {
  const allowOrigin = origin || getAppOrigin() || "https://ginote.yekai.ltd";
  return `# ~/.jupyter/jupyter_server_config.py
c.ServerApp.allow_origin = "${allowOrigin}"
c.ServerApp.allow_credentials = True
c.ServerApp.disable_check_xsrf = True

c.ServerApp.tornado_settings = {
    "headers": {
        "Access-Control-Allow-Private-Network": "true",
    },
}

# 启动：jupyter lab --no-browser --port=8888
# GiNote 设置：Server URL = http://127.0.0.1:8888，Token = 启动日志中的 token`;
}

export function getJupyterTroubleshootingSteps(baseUrl: string): string[] {
  const origin = getAppOrigin();
  const steps = [
    "1. 确认本机 Jupyter 已启动：在浏览器打开 http://127.0.0.1:8888/?token=你的token",
    `2. 在 ~/.jupyter/jupyter_server_config.py 中设置 allow_origin = "${origin}"`,
    "3. 添加 Access-Control-Allow-Private-Network: true（见设置中的配置示例）",
    "4. 重启 Jupyter，在 GiNote 设置中填入 Token 后点击「测试连接」",
  ];
  if (!isProductionRemoteAccess(baseUrl)) {
    return steps.slice(0, 1).concat(steps.slice(2));
  }
  return steps;
}

function isFetchNetworkError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  return (
    msg.includes("failed to fetch") ||
    msg.includes("networkerror") ||
    msg.includes("network request failed") ||
    err.name === "TypeError"
  );
}

export function formatJupyterConnectionError(
  err: unknown,
  config: JupyterConnectionConfig
): string {
  const baseUrl = config.baseUrl.replace(/\/$/, "");
  const remote = isProductionRemoteAccess(config.baseUrl);
  const origin = getAppOrigin();

  if (err instanceof Error && err.message.includes("WebSocket")) {
    return [
      "WebSocket 连接失败。",
      remote
        ? `请确认 Jupyter 已配置 CORS（allow_origin = "${origin}"）与 Private Network Access 响应头，并已重启。`
        : "请确认 Jupyter 正在运行，且 Token 正确。",
    ].join("\n");
  }

  if (isFetchNetworkError(err)) {
    const lines = [
      "无法连接到 Jupyter（浏览器拦截或 Jupyter 未启动）。",
      "",
      remote
        ? `当前从 ${origin} 访问本机 ${baseUrl}，浏览器会执行 CORS + Private Network Access 检查。`
        : `请确认 Jupyter 已在 ${baseUrl} 运行。`,
      "",
      "请按以下步骤排查：",
      ...getJupyterTroubleshootingSteps(config.baseUrl).map((s) => `• ${s.replace(/^\d+\.\s*/, "")}`),
    ];
    if (remote) {
      lines.push(
        "",
        "备选：用 Cloudflare Tunnel / ngrok 暴露 HTTPS Jupyter URL，在设置中填入该地址（可避免公网→私网限制）。"
      );
    }
    return lines.join("\n");
  }

  if (err instanceof Error) {
    if (err.message.includes("403") || err.message.includes("401")) {
      return [
        err.message,
        "",
        !config.token
          ? "• 未填写 Token：请在 GiNote 设置中填入 Jupyter 启动日志里的 token。"
          : "• Token 可能无效：请重启 Jupyter 并使用新 token。",
      ].join("\n");
    }
    return err.message;
  }

  return "连接失败";
}

export function getProductionRemoteAccessWarning(baseUrl: string): string | null {
  if (!isProductionRemoteAccess(baseUrl)) return null;
  return `当前为线上站点（${getAppOrigin()}），连接本机 Jupyter 需在本机开启 CORS 与 Private Network Access。见下方配置示例。`;
}
