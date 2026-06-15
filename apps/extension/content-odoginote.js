const SYNC_REQUEST = "ODOGINOTE_SYNC_GITHUB_SESSION";
const SYNC_RESPONSE = "ODOGINOTE_SYNC_GITHUB_SESSION_RESULT";

document.documentElement.dataset.odoginoteExtension = "true";

function postResult(requestId, payload) {
  window.postMessage({ type: SYNC_RESPONSE, requestId, ...payload }, window.location.origin);
}

async function syncSession(requestId) {
  try {
    const session = await new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ action: "getUserSession" }, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        if (!response) {
          reject(new Error("NO_RESPONSE"));
          return;
        }
        if (response.error === "NOT_LOGGED_IN") {
          reject(new Error("NOT_LOGGED_IN"));
          return;
        }
        if (response.error) {
          reject(new Error(response.message || response.error));
          return;
        }
        resolve(response.userSession);
      });
    });

    const res = await fetch("/api/auth/github-session", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userSession: session }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      postResult(requestId, {
        ok: false,
        error: err.error || `HTTP ${res.status}`,
        code: err.code,
      });
      return;
    }

    const data = await res.json();
    postResult(requestId, { ok: true, connected: data.connected, updatedAt: data.updatedAt });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "SYNC_FAILED";
    postResult(requestId, { ok: false, error: msg, code: msg });
  }
}

window.addEventListener("message", (event) => {
  if (event.source !== window || event.origin !== window.location.origin) return;
  const data = event.data;
  if (!data || data.type !== SYNC_REQUEST || !data.requestId) return;
  void syncSession(data.requestId);
});
