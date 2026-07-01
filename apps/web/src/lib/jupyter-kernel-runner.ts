import type { JupyterOutput } from "@odoginote/shared";
import type { JupyterConnectionConfig, KernelRunResult, KernelStatus } from "./kernel-runner";
import { formatJupyterConnectionError, isLocalJupyterUrl } from "./jupyter-connection-diagnostics";
import {
  createMessage,
  createSessionId,
  decodeWireMessage,
  encodeWireMessage,
  iopubToOutput,
  isExecuteReplyError,
  isIdleStatus,
} from "./jupyter-messages";

export function resolveJupyterBaseUrl(config: JupyterConnectionConfig): string {
  const useProxy = import.meta.env.DEV && isLocalJupyterUrl(config.baseUrl);
  if (useProxy) return "/jupyter";
  return config.baseUrl.replace(/\/$/, "");
}

function wsUrlFromHttp(baseUrl: string, path: string, token?: string): string {
  if (baseUrl.startsWith("/")) {
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    const url = new URL(`${baseUrl}${normalizedPath}`, window.location.origin);
    url.protocol = proto;
    if (token) url.searchParams.set("token", token);
    return url.toString();
  }
  const url = new URL(path, baseUrl.replace(/\/$/, "") + "/");
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  if (token) url.searchParams.set("token", token);
  return url.toString();
}

export class JupyterKernelRunner {
  private _status: KernelStatus = "disconnected";
  private config: JupyterConnectionConfig | null = null;
  private kernelId: string | null = null;
  private sessionId = createSessionId();
  private ws: WebSocket | null = null;
  private kernelDisplayName = "Python 3";
  private pendingExecutes = new Map<
    string,
    {
      resolve: (result: KernelRunResult) => void;
      reject: (err: Error) => void;
      outputs: JupyterOutput[];
    }
  >();

  get status(): KernelStatus {
    return this._status;
  }

  get displayName(): string {
    return this.kernelDisplayName;
  }

  private authHeaders(token?: string): HeadersInit {
    const headers: HeadersInit = { "Content-Type": "application/json" };
    if (token) headers.Authorization = `token ${token}`;
    return headers;
  }

  private async jfetch(path: string, init?: RequestInit): Promise<Response> {
    if (!this.config) throw new Error("Jupyter 未配置");
    const base = resolveJupyterBaseUrl(this.config);
    const url = `${base}${path}`;
    const token = this.config.token;
    const headers = { ...this.authHeaders(token), ...(init?.headers ?? {}) };
    const res = await fetch(url, { ...init, headers });
    return res;
  }

  async connect(config: JupyterConnectionConfig): Promise<void> {
    this._status = "connecting";
    this.config = config;
    try {
      const specsRes = await this.jfetch("/api/kernelspecs");
      if (!specsRes.ok) {
        throw new Error(`无法连接 Jupyter (${specsRes.status})，请检查 URL、Token 与 CORS 设置`);
      }
      const specs = (await specsRes.json()) as {
        kernelspecs: Record<string, { name: string; spec?: { display_name?: string } }>;
      };
      const kernelName = config.kernelName || "python3";
      const spec = specs.kernelspecs[kernelName];
      this.kernelDisplayName = spec?.spec?.display_name ?? spec?.name ?? kernelName;

      const kernelRes = await this.jfetch("/api/kernels", {
        method: "POST",
        body: JSON.stringify({ name: kernelName }),
      });
      if (!kernelRes.ok) {
        throw new Error(`创建内核失败 (${kernelRes.status})`);
      }
      const kernel = (await kernelRes.json()) as { id: string };
      this.kernelId = kernel.id;
      this.sessionId = createSessionId();
      await this.openWebSocket();
      this._status = "ready";
    } catch (err) {
      this._status = "disconnected";
      this.kernelId = null;
      throw new Error(formatJupyterConnectionError(err, config));
    }
  }

  private openWebSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.kernelId || !this.config) {
        reject(new Error("内核未初始化"));
        return;
      }
      const base = resolveJupyterBaseUrl(this.config);
      const path = `/api/kernels/${this.kernelId}/channels?session_id=${this.sessionId}`;
      const url = wsUrlFromHttp(base, path, this.config.token);
      const ws = new WebSocket(url);
      this.ws = ws;

      ws.onopen = () => resolve();
      ws.onerror = () => reject(new Error("WebSocket 连接失败"));
      ws.onmessage = (ev) => this.handleMessage(String(ev.data));
      ws.onclose = () => {
        if (this._status === "ready") this._status = "disconnected";
      };
    });
  }

  private handleMessage(raw: string): void {
    const msg = decodeWireMessage(raw);
    if (!msg) return;

    const parentId = (msg.parent_header as { msg_id?: string })?.msg_id;
    if (!parentId) return;

    const pending = this.pendingExecutes.get(parentId);
    if (!pending) return;

    const output = iopubToOutput(msg);
    if (output) pending.outputs.push(output);

    if (isExecuteReplyError(msg, parentId)) {
      const content = msg.content;
      pending.outputs.push({
        output_type: "error",
        ename: String(content.ename ?? "Error"),
        evalue: String(content.evalue ?? ""),
        traceback: Array.isArray(content.traceback)
          ? content.traceback.map(String)
          : undefined,
      });
    }

    if (isIdleStatus(msg, parentId)) {
      this.pendingExecutes.delete(parentId);
      pending.resolve({ outputs: pending.outputs });
    }
  }

  async disconnect(): Promise<void> {
    const kernelId = this.kernelId;
    this.pendingExecutes.forEach((p) => p.reject(new Error("内核已断开")));
    this.pendingExecutes.clear();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    if (kernelId && this.config) {
      try {
        await this.jfetch(`/api/kernels/${kernelId}`, { method: "DELETE" });
      } catch {
        /* ignore */
      }
    }
    this.kernelId = null;
    this._status = "disconnected";
  }

  async interrupt(): Promise<void> {
    if (!this.kernelId) return;
    await this.jfetch(`/api/kernels/${this.kernelId}/interrupt`, { method: "POST" });
  }

  async restart(): Promise<void> {
    if (!this.kernelId) throw new Error("内核未连接");
    await this.jfetch(`/api/kernels/${this.kernelId}/restart`, { method: "POST" });
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    await this.openWebSocket();
  }

  async runCell(code: string): Promise<KernelRunResult> {
    if (this._status !== "ready" || !this.ws || !this.config) {
      return {
        outputs: [],
        error: "未连接 Jupyter 内核。请在设置中配置并启动本地 Jupyter Server。",
      };
    }

    const msg = createMessage(
      "execute_request",
      {
        code,
        silent: false,
        store_history: true,
        user_expressions: {},
        allow_stdin: false,
        stop_on_error: true,
      },
      this.sessionId
    );

    return new Promise<KernelRunResult>((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        this.pendingExecutes.delete(msg.header.msg_id);
        reject(new Error("执行超时（60s）"));
      }, 60_000);

      this.pendingExecutes.set(msg.header.msg_id, {
        outputs: [],
        resolve: (result) => {
          window.clearTimeout(timeout);
          resolve(result);
        },
        reject: (err) => {
          window.clearTimeout(timeout);
          reject(err);
        },
      });

      try {
        this.ws!.send(encodeWireMessage("shell", msg));
      } catch (err) {
        window.clearTimeout(timeout);
        this.pendingExecutes.delete(msg.header.msg_id);
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    }).catch((err: unknown): KernelRunResult => ({
      outputs: [],
      error: err instanceof Error ? err.message : String(err),
    }));
  }
}

export async function testJupyterConnection(
  config: JupyterConnectionConfig
): Promise<{ ok: true; kernels: string[] } | { ok: false; error: string }> {
  try {
    const base = resolveJupyterBaseUrl(config);
    const headers: HeadersInit = {};
    if (config.token) headers.Authorization = `token ${config.token}`;
    const res = await fetch(`${base}/api/kernelspecs`, { headers });
    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status}：请检查 URL、Token 与 CORS` };
    }
    const data = (await res.json()) as {
      kernelspecs: Record<string, { spec?: { display_name?: string } }>;
    };
    const kernels = Object.entries(data.kernelspecs).map(
      ([name, spec]) => spec.spec?.display_name ?? name
    );
    return { ok: true, kernels };
  } catch (err) {
    return {
      ok: false,
      error: formatJupyterConnectionError(err, config),
    };
  }
}
