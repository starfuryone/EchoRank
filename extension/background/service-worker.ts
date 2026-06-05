import type { Message, ImportPayload, ImportResult, ExtensionPlatform } from "../shared/types";
import { getConfig } from "../shared/storage";

/**
 * Background service worker. The single privileged actor: it holds the API
 * token and performs the import POST under host_permissions (so the request is
 * not subject to page CORS). Content scripts only scrape; the popup only
 * orchestrates. Tokens never touch page context.
 */

const SUPPORTED_HOSTS: Record<string, ExtensionPlatform> = {
  "www.google.com": "GOOGLE",
  "www.facebook.com": "FACEBOOK",
  "www.trustpilot.com": "TRUSTPILOT",
};

function platformForUrl(url: string | undefined): ExtensionPlatform | null {
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

async function postImport(payload: ImportPayload): Promise<ImportResult> {
  const { token, apiBase } = await getConfig();
  if (!token) return { ok: false, status: 401, error: "No token saved. Open Settings in the popup." };

  try {
    const res = await fetch(`${apiBase}/api/extension/import`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        // Enables server-side idempotency; mirrors payload.batchId.
        ...(payload.batchId ? { "X-Idempotency-Key": payload.batchId } : {}),
      },
      body: JSON.stringify(payload),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, status: res.status, error: body.error ?? `HTTP ${res.status}` };
    }
    return {
      ok: true,
      status: res.status,
      received: body.data?.received,
      importId: body.data?.importId,
    };
  } catch (err) {
    return { ok: false, status: 0, error: err instanceof Error ? err.message : "Network error" };
  }
}

async function getActiveTab(): Promise<chrome.tabs.Tab | undefined> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

/** Ask the active tab's content script to scrape, with a timeout. */
function requestScrape(tabId: number): Promise<Message | null> {
  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve(null);
      }
    }, 45_000);
    chrome.tabs.sendMessage(tabId, { type: "SCRAPE_ACTIVE_TAB" } as Message, (resp?: Message) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (chrome.runtime.lastError) resolve(null);
      else resolve(resp ?? null);
    });
  });
}

chrome.runtime.onMessage.addListener((msg: Message, _sender, sendResponse) => {
  // Popup → SW: report status of the active tab + saved token.
  if (msg.type === "GET_STATUS") {
    (async () => {
      const [{ token }, tab] = await Promise.all([getConfig(), getActiveTab()]);
      const platform = platformForUrl(tab?.url);
      sendResponse({
        type: "STATUS",
        loggedIn: !!token,
        tokenPrefix: token ? token.slice(0, 14) : null,
        siteSupported: platform != null,
        platform,
      } satisfies Message);
    })();
    return true;
  }

  // Popup → SW: run the full scan → import flow on the active tab.
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
          result: { ok: false, status: 0, error: "This site is not supported" },
        });
        return;
      }

      const scraped = await requestScrape(tab.id);
      if (!scraped || scraped.type !== "SCRAPE_RESULT") {
        sendResponse({
          type: "IMPORT_RESULT",
          result: { ok: false, status: 0, error: "Could not read reviews from the page" },
        });
        return;
      }
      if (scraped.reviews.length === 0) {
        sendResponse({
          type: "IMPORT_RESULT",
          result: { ok: false, status: 0, error: "No reviews found on this page" },
        });
        return;
      }

      const payload: ImportPayload = {
        platform,
        pageUrl: scraped.pageUrl,
        businessName: scraped.businessName ?? null,
        reviews: scraped.reviews,
        batchId: crypto.randomUUID(),
      };
      const result = await postImport(payload);
      sendResponse({ type: "IMPORT_RESULT", result } satisfies Message);
    })();
    return true;
  }
});
