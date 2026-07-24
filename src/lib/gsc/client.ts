// Plain-REST Google OAuth + Search Console client (no SDK — zero new deps).
// Scope is webmasters.readonly ONLY. Tokens are handled in memory and never
// logged; refresh tokens are persisted encrypted by the service layer.

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://echorank360.com";
export const GSC_REDIRECT_URI = `${SITE}/api/ai/visibility/gsc/callback`;
export const GSC_SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";

function clientId(): string {
  const v = process.env.GOOGLE_OAUTH_CLIENT_ID;
  if (!v) throw new Error("GOOGLE_OAUTH_CLIENT_ID is not set");
  return v;
}
function clientSecret(): string {
  const v = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!v) throw new Error("GOOGLE_OAUTH_CLIENT_SECRET is not set");
  return v;
}

/** Thrown when Google says the refresh token is dead (revoked/expired). */
export class GscReauthError extends Error {
  constructor() {
    super("Google Search Console connection needs re-authorization.");
    this.name = "GscReauthError";
  }
}

export function buildAuthUrl(state: string): string {
  const p = new URLSearchParams({
    client_id: clientId(),
    redirect_uri: GSC_REDIRECT_URI,
    response_type: "code",
    scope: GSC_SCOPE,
    access_type: "offline", // guarantees a refresh token...
    prompt: "consent",      // ...even on re-connection
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${p.toString()}`;
}

export interface TokenExchange {
  accessToken: string;
  refreshToken: string | null;
}

export async function exchangeCode(code: string): Promise<TokenExchange> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId(),
      client_secret: clientSecret(),
      redirect_uri: GSC_REDIRECT_URI,
      grant_type: "authorization_code",
    }),
  });
  const data = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    error?: string;
  };
  if (!res.ok || !data.access_token) {
    throw new Error(`Token exchange failed: ${data.error ?? res.status}`);
  }
  return { accessToken: data.access_token, refreshToken: data.refresh_token ?? null };
}

export async function mintAccessToken(refreshToken: string): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId(),
      client_secret: clientSecret(),
      grant_type: "refresh_token",
    }),
  });
  const data = (await res.json()) as { access_token?: string; error?: string };
  if (data.error === "invalid_grant") throw new GscReauthError();
  if (!res.ok || !data.access_token) {
    throw new Error(`Access token mint failed: ${data.error ?? res.status}`);
  }
  return data.access_token;
}

export interface GscSite {
  siteUrl: string;
  permissionLevel: string;
}

export async function listSites(accessToken: string): Promise<GscSite[]> {
  const res = await fetch("https://www.googleapis.com/webmasters/v3/sites", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Site list failed: ${res.status}`);
  const data = (await res.json()) as { siteEntry?: GscSite[] };
  return (data.siteEntry ?? []).filter((s) => s.permissionLevel !== "siteUnverifiedUser");
}

export interface SearchAnalyticsRow {
  keys: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export async function searchAnalytics(
  accessToken: string,
  siteUrl: string,
  body: {
    startDate: string;
    endDate: string;
    dimensions: string[];
    rowLimit?: number;
  },
): Promise<SearchAnalyticsRow[]> {
  const res = await fetch(
    `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );
  if (res.status === 401) throw new GscReauthError();
  if (!res.ok) throw new Error(`Search analytics query failed: ${res.status}`);
  const data = (await res.json()) as { rows?: SearchAnalyticsRow[] };
  return data.rows ?? [];
}
