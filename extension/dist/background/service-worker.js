// shared/storage.ts
var DEFAULT_API_BASE = "https://echorank360.com";
async function getConfig() {
  const stored = await chrome.storage.local.get(["token", "apiBase"]);
  return {
    token: stored.token,
    apiBase: stored.apiBase?.replace(/\/+$/, "") || DEFAULT_API_BASE
  };
}

// background/service-worker.ts
var SUPPORTED_HOSTS = {
  "www.google.com": "GOOGLE",
  "www.facebook.com": "FACEBOOK",
  "www.trustpilot.com": "TRUSTPILOT"
};
function platformForUrl(url) {
  if (!url) return null;
  try {
    const host = new URL(url).hostname.replace(/^m\./, "www.");
    if (SUPPORTED_HOSTS[host]) return SUPPORTED_HOSTS[host];
    if (host.endsWith("trustpilot.com")) return "TRUSTPILOT";
    return null;
  } catch {
    return null;
  }
}
async function postImport(payload) {
  const { token, apiBase } = await getConfig();
  if (!token) return { ok: false, status: 401, error: "No token saved. Open Settings in the popup." };
  try {
    const res = await fetch(`${apiBase}/api/extension/import`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        // Enables server-side idempotency; mirrors payload.batchId.
        ...payload.batchId ? { "X-Idempotency-Key": payload.batchId } : {}
      },
      body: JSON.stringify(payload)
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, status: res.status, error: body.error ?? `HTTP ${res.status}` };
    }
    return {
      ok: true,
      status: res.status,
      received: body.data?.received,
      importId: body.data?.importId
    };
  } catch (err) {
    return { ok: false, status: 0, error: err instanceof Error ? err.message : "Network error" };
  }
}
async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}
function requestScrape(tabId) {
  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve(null);
      }
    }, 45e3);
    chrome.tabs.sendMessage(tabId, { type: "SCRAPE_ACTIVE_TAB" }, (resp) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (chrome.runtime.lastError) resolve(null);
      else resolve(resp ?? null);
    });
  });
}
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === "GET_STATUS") {
    (async () => {
      const [{ token }, tab] = await Promise.all([getConfig(), getActiveTab()]);
      const platform = platformForUrl(tab?.url);
      sendResponse({
        type: "STATUS",
        loggedIn: !!token,
        tokenPrefix: token ? token.slice(0, 14) : null,
        siteSupported: platform != null,
        platform
      });
    })();
    return true;
  }
  if (msg.type === "SCRAPE_ACTIVE_TAB") {
    (async () => {
      const tab = await getActiveTab();
      if (!tab?.id || !tab.url) {
        sendResponse({ type: "IMPORT_RESULT", result: { ok: false, status: 0, error: "No active tab" } });
        return;
      }
      const platform = platformForUrl(tab.url);
      if (!platform) {
        sendResponse({
          type: "IMPORT_RESULT",
          result: { ok: false, status: 0, error: "This site is not supported" }
        });
        return;
      }
      const scraped = await requestScrape(tab.id);
      if (!scraped || scraped.type !== "SCRAPE_RESULT") {
        sendResponse({
          type: "IMPORT_RESULT",
          result: { ok: false, status: 0, error: "Could not read reviews from the page" }
        });
        return;
      }
      if (scraped.reviews.length === 0) {
        sendResponse({
          type: "IMPORT_RESULT",
          result: { ok: false, status: 0, error: "No reviews found on this page" }
        });
        return;
      }
      const payload = {
        platform,
        pageUrl: scraped.pageUrl,
        businessName: scraped.businessName ?? null,
        reviews: scraped.reviews,
        batchId: crypto.randomUUID()
      };
      const result = await postImport(payload);
      sendResponse({ type: "IMPORT_RESULT", result });
    })();
    return true;
  }
});
//# sourceMappingURL=service-worker.js.map
