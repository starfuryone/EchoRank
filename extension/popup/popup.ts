import type { Message } from "../shared/types";
import { getConfig, setToken, setApiBase } from "../shared/storage";

/**
 * Popup logic. Vanilla TS rather than React: a popup this small does not justify
 * bundling a React runtime into the extension (React 19 is the web app's stack,
 * not the extension's). Keeps the esbuild step trivial and the popup instant.
 */

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

function send<T extends Message>(msg: Message): Promise<T | undefined> {
  return new Promise((resolve) => chrome.runtime.sendMessage(msg, (r) => resolve(r)));
}

function setStatusLine(id: string, ok: boolean, label: string) {
  $(id).innerHTML = `<span class="dot ${ok ? "ok" : "bad"}"></span>${label}`;
}

function showMsg(text: string, ok: boolean) {
  const el = $("msg");
  el.textContent = text;
  el.className = `msg ${ok ? "ok" : "bad"}`;
  el.style.display = "block";
}

async function refreshStatus() {
  const status = await send<Message>({ type: "GET_STATUS" });
  if (!status || status.type !== "STATUS") return;
  setStatusLine("login-status", status.loggedIn, status.loggedIn ? "Connected" : "Not connected — add a token in Settings");
  setStatusLine(
    "site-status",
    status.siteSupported,
    status.siteSupported ? `Supported: ${status.platform}` : "Open a Google, Facebook, or Trustpilot review page",
  );
  ($("scan") as HTMLButtonElement).disabled = !(status.loggedIn && status.siteSupported);
}

async function loadSettings() {
  const cfg = await getConfig();
  ($("apibase") as HTMLInputElement).value = cfg.apiBase;
  if (cfg.token) ($("token") as HTMLInputElement).placeholder = "•••••• (saved — paste to replace)";
}

$("toggle-settings").addEventListener("click", () => $("settings").classList.toggle("open"));

$("save").addEventListener("click", async () => {
  const token = ($("token") as HTMLInputElement).value.trim();
  const apiBase = ($("apibase") as HTMLInputElement).value.trim();
  if (apiBase) await setApiBase(apiBase);
  if (token) await setToken(token);
  ($("token") as HTMLInputElement).value = "";
  showMsg("Saved.", true);
  await refreshStatus();
});

$("scan").addEventListener("click", async () => {
  const btn = $("scan") as HTMLButtonElement;
  btn.disabled = true;
  btn.textContent = "Scanning… (scrolling the page)";
  $("msg").style.display = "none";

  const resp = await send<Message>({ type: "SCRAPE_ACTIVE_TAB" });
  btn.textContent = "Scan & Import Reviews";

  if (!resp || resp.type !== "IMPORT_RESULT") {
    showMsg("Something went wrong.", false);
    await refreshStatus();
    return;
  }
  const r = resp.result;
  if (r.ok) {
    $("found").textContent = String(r.received ?? 0);
    $("imported").textContent = String(r.received ?? 0);
    showMsg(`Sent ${r.received ?? 0} reviews. Analysis runs automatically — check Monitoring.`, true);
  } else {
    $("failed").textContent = "1";
    showMsg(r.error ?? "Import failed", false);
  }
  await refreshStatus();
});

void loadSettings();
void refreshStatus();
