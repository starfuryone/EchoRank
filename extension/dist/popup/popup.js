// shared/storage.ts
var DEFAULT_API_BASE = "https://echorank360.com";
async function getConfig() {
  const stored = await chrome.storage.local.get(["token", "apiBase"]);
  return {
    token: stored.token,
    apiBase: stored.apiBase?.replace(/\/+$/, "") || DEFAULT_API_BASE
  };
}
async function setToken(token) {
  await chrome.storage.local.set({ token: token.trim() });
}
async function setApiBase(apiBase) {
  await chrome.storage.local.set({ apiBase: apiBase.trim().replace(/\/+$/, "") });
}

// popup/popup.ts
var $ = (id) => document.getElementById(id);
function send(msg) {
  return new Promise((resolve) => chrome.runtime.sendMessage(msg, (r) => resolve(r)));
}
function setStatusLine(id, ok, label) {
  $(id).innerHTML = `<span class="dot ${ok ? "ok" : "bad"}"></span>${label}`;
}
function showMsg(text, ok) {
  const el = $("msg");
  el.textContent = text;
  el.className = `msg ${ok ? "ok" : "bad"}`;
  el.style.display = "block";
}
async function refreshStatus() {
  const status = await send({ type: "GET_STATUS" });
  if (!status || status.type !== "STATUS") return;
  setStatusLine("login-status", status.loggedIn, status.loggedIn ? "Connected" : "Not connected \u2014 add a token in Settings");
  setStatusLine(
    "site-status",
    status.siteSupported,
    status.siteSupported ? `Supported: ${status.platform}` : "Open a Google, Facebook, or Trustpilot review page"
  );
  $("scan").disabled = !(status.loggedIn && status.siteSupported);
}
async function loadSettings() {
  const cfg = await getConfig();
  $("apibase").value = cfg.apiBase;
  if (cfg.token) $("token").placeholder = "\u2022\u2022\u2022\u2022\u2022\u2022 (saved \u2014 paste to replace)";
}
$("toggle-settings").addEventListener("click", () => $("settings").classList.toggle("open"));
$("save").addEventListener("click", async () => {
  const token = $("token").value.trim();
  const apiBase = $("apibase").value.trim();
  if (apiBase) await setApiBase(apiBase);
  if (token) await setToken(token);
  $("token").value = "";
  showMsg("Saved.", true);
  await refreshStatus();
});
$("scan").addEventListener("click", async () => {
  const btn = $("scan");
  btn.disabled = true;
  btn.textContent = "Scanning\u2026 (scrolling the page)";
  $("msg").style.display = "none";
  const resp = await send({ type: "SCRAPE_ACTIVE_TAB" });
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
    showMsg(`Sent ${r.received ?? 0} reviews. Analysis runs automatically \u2014 check Monitoring.`, true);
  } else {
    $("failed").textContent = "1";
    showMsg(r.error ?? "Import failed", false);
  }
  await refreshStatus();
});
void loadSettings();
void refreshStatus();
//# sourceMappingURL=popup.js.map
