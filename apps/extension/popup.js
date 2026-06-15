const statusEl = document.getElementById("status");
const syncBtn = document.getElementById("syncBtn");

function setStatus(text, kind) {
  statusEl.textContent = text;
  statusEl.className = kind || "";
}

async function findOdoginoteTab() {
    const patterns = [
    "https://odoginote.jellyyekai.workers.dev/*",
    "https://ginote.yekai.ltd/*",
    "http://localhost:5173/*",
  ];
  for (const pattern of patterns) {
    const tabs = await chrome.tabs.query({ url: pattern });
    if (tabs.length > 0) return tabs[0];
  }
  return null;
}

syncBtn.addEventListener("click", async () => {
  syncBtn.disabled = true;
  setStatus("同步中…");

  try {
    const tab = await findOdoginoteTab();
    if (!tab?.id) {
      setStatus("请先打开 GiNote 页面", "error");
      return;
    }

    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        window.postMessage(
          { type: "ODOGINOTE_SYNC_GITHUB_SESSION", requestId: "popup-" + Date.now() },
          window.location.origin
        );
      },
    });

      setStatus("已发送同步请求，请查看 GiNote 设置页状态", "ok");
  } catch (e) {
    setStatus(e instanceof Error ? e.message : "同步失败", "error");
  } finally {
    syncBtn.disabled = false;
  }
});
