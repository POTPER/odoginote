const GITHUB_URL = "https://github.com";

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.action !== "getUserSession") return;

  chrome.cookies.get({ url: GITHUB_URL, name: "user_session" }, (cookie) => {
    if (chrome.runtime.lastError) {
      sendResponse({ error: "COOKIE_READ_FAILED", message: chrome.runtime.lastError.message });
      return;
    }
    if (!cookie?.value) {
      sendResponse({ error: "NOT_LOGGED_IN" });
      return;
    }
    sendResponse({ userSession: cookie.value });
  });

  return true;
});
