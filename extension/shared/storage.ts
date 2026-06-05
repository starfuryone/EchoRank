import type { StoredConfig } from "./types";

const DEFAULT_API_BASE = "https://echorank360.com";

export async function getConfig(): Promise<Required<Pick<StoredConfig, "apiBase">> & StoredConfig> {
  const stored = (await chrome.storage.local.get(["token", "apiBase"])) as StoredConfig;
  return {
    token: stored.token,
    apiBase: stored.apiBase?.replace(/\/+$/, "") || DEFAULT_API_BASE,
  };
}

export async function setToken(token: string): Promise<void> {
  await chrome.storage.local.set({ token: token.trim() });
}

export async function clearToken(): Promise<void> {
  await chrome.storage.local.remove("token");
}

export async function setApiBase(apiBase: string): Promise<void> {
  await chrome.storage.local.set({ apiBase: apiBase.trim().replace(/\/+$/, "") });
}
