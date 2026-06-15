const SYNC_REQUEST = "ODOGINOTE_SYNC_GITHUB_SESSION";
const SYNC_RESPONSE = "ODOGINOTE_SYNC_GITHUB_SESSION_RESULT";
const SYNC_TIMEOUT_MS = 5000;

declare global {
  interface Window {
    __ODOGINOTE_EXTENSION__?: boolean;
  }
}

export function isExtensionInstalled(): boolean {
  return document.documentElement.dataset.odoginoteExtension === "true";
}

export interface ExtensionSyncResult {
  ok: boolean;
  error?: string;
  code?: string;
  connected?: boolean;
  updatedAt?: string | null;
}

export function syncGitHubSessionViaExtension(): Promise<ExtensionSyncResult> {
  return new Promise((resolve) => {
    if (!isExtensionInstalled()) {
      resolve({ ok: false, error: "扩展未安装", code: "EXTENSION_NOT_INSTALLED" });
      return;
    }

    const requestId = `web-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const timer = window.setTimeout(() => {
      window.removeEventListener("message", onMessage);
      resolve({ ok: false, error: "同步超时", code: "TIMEOUT" });
    }, SYNC_TIMEOUT_MS);

    function onMessage(event: MessageEvent) {
      if (event.source !== window || event.origin !== window.location.origin) return;
      const data = event.data;
      if (!data || data.type !== SYNC_RESPONSE || data.requestId !== requestId) return;

      window.clearTimeout(timer);
      window.removeEventListener("message", onMessage);
      resolve({
        ok: Boolean(data.ok),
        error: data.error,
        code: data.code,
        connected: data.connected,
        updatedAt: data.updatedAt ?? null,
      });
    }

    window.addEventListener("message", onMessage);
    window.postMessage({ type: SYNC_REQUEST, requestId }, window.location.origin);
  });
}
