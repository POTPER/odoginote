import type { JupyterOutput } from "@odoginote/shared";

export interface KernelRunResult {
  outputs: JupyterOutput[];
  error?: string;
}

export interface JupyterConnectionConfig {
  baseUrl: string;
  token?: string;
  kernelName?: string;
}

export type KernelStatus = "disconnected" | "connecting" | "ready";

export interface KernelRunner {
  readonly status: KernelStatus;
  readonly displayName?: string;
  connect(config: JupyterConnectionConfig): Promise<void>;
  disconnect(): Promise<void>;
  runCell(code: string, sessionId?: string): Promise<KernelRunResult>;
  interrupt?(): Promise<void>;
  restart?(): Promise<void>;
}

const JUPYTER_SETTINGS_KEY = "odoginote.jupyter";

export function loadJupyterConfig(): JupyterConnectionConfig {
  try {
    const raw = localStorage.getItem(JUPYTER_SETTINGS_KEY);
    if (!raw) return { baseUrl: "http://127.0.0.1:8888" };
    return { baseUrl: "http://127.0.0.1:8888", ...JSON.parse(raw) };
  } catch {
    return { baseUrl: "http://127.0.0.1:8888" };
  }
}

export function saveJupyterConfig(config: JupyterConnectionConfig): void {
  localStorage.setItem(JUPYTER_SETTINGS_KEY, JSON.stringify(config));
}

export class NullKernelRunner implements KernelRunner {
  readonly status: KernelStatus = "disconnected";

  async connect(_config: JupyterConnectionConfig): Promise<void> {
    /* future: JupyterKernelRunner */
  }

  async disconnect(): Promise<void> {
    /* noop */
  }

  async runCell(_code: string, _sessionId?: string): Promise<KernelRunResult> {
    return {
      outputs: [],
      error: "未连接 Jupyter 内核。请在设置中配置本地 Jupyter Server。",
    };
  }
}

export const nullKernelRunner = new NullKernelRunner();
