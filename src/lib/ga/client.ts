// Plain-REST Google OAuth + GA4 client (no SDK — zero new deps), mirroring
// lib/gsc/client.ts so both Google integrations fail the same shape.
//
// Scope is analytics.readonly ONLY. Tokens are handled in memory and never
// logged; refresh tokens are persisted encrypted by the service layer.
//
// ⚠ GOOGLE CLOUD CONSOLE PREREQUISITES — this feature cannot work until both
// are done on the OAuth client that GOOGLE_OAUTH_CLIENT_ID identifies:
//   1. OAuth consent screen -> Data access: add the scope
//      https://www.googleapis.com/auth/analytics.readonly
//   2. Credentials -> the OAuth 2.0 Client -> Authorized redirect URIs: add
//      <NEXT_PUBLIC_SITE_URL>/api/seo/v1/web-analytics/callback
// Missing either produces a Google-side error before our code runs; the
// callback maps them to explicit `ga_error` codes rather than a blank page.
// Also enable the Google Analytics Data API and Admin API for the project.

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://echorank360.com";
export const GA_REDIRECT_URI = `${SITE}/api/seo/v1/web-analytics/callback`;
export const GA_SCOPE = "https://www.googleapis.com/auth/analytics.readonly";

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
export class GaReauthError extends Error {
  constructor() {
    super("Google Analytics connection needs re-authorization.");
    this.name = "GaReauthError";
  }
}

/** Thrown on GA4 quota exhaustion (429), which is per-property and recovers. */
export class GaQuotaError extends Error {
  constructor(message = "Google Analytics is rate limiting this property.") {
    super(message);
    this.name = "GaQuotaError";
  }
}

/**
 * Thrown when the consent screen has not been given the analytics.readonly
 * scope — Google returns the token but the API then rejects every call with
 * 403 PERMISSION_DENIED / insufficient scope. Surfaced distinctly because the
 * fix is a Cloud Console change, not a user action.
 */
export class GaScopeError extends Error {
  constructor() {
    super("The Google connection is missing the Analytics read scope.");
    this.name = "GaScopeError";
  }
}

export function buildAuthUrl(state: string): string {
  const p = new URLSearchParams({
    client_id: clientId(),
    redirect_uri: GA_REDIRECT_URI,
    response_type: "code",
    scope: GA_SCOPE,
    access_type: "offline", // guarantees a refresh token...
    prompt: "consent", // ...even on re-connection
    // Lets Google merge this grant with any other scopes the user already
    // gave this client, so connecting Analytics does not silently revoke the
    // Search Console grant made from the same account.
    include_granted_scopes: "true",
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
      redirect_uri: GA_REDIRECT_URI,
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
  if (data.error === "invalid_grant") throw new GaReauthError();
  if (!res.ok || !data.access_token) {
    throw new Error(`Access token mint failed: ${data.error ?? res.status}`);
  }
  return data.access_token;
}

/** Maps a Google API failure onto our typed errors. */
async function raiseForStatus(res: Response, what: string): Promise<never> {
  const body = await res.text().catch(() => "");
  if (res.status === 401) throw new GaReauthError();
  if (res.status === 429) throw new GaQuotaError();
  if (res.status === 403) {
    // 403 covers both "scope not granted" and "no access to this property".
    // The scope case names itself in the payload; anything else is a genuine
    // permission problem on the property.
    if (/insufficient|scope|ACCESS_TOKEN_SCOPE/i.test(body)) throw new GaScopeError();
    // Quota exhaustion is also reported as 403 on some GA4 endpoints.
    if (/quota|exhausted|RESOURCE_EXHAUSTED/i.test(body)) throw new GaQuotaError();
  }
  throw new Error(`${what} failed: ${res.status} ${body.slice(0, 300)}`);
}

// ─── Admin API: which properties can this user read? ────────────────────────

export interface GaProperty {
  /** "properties/123456789" — the id every Data API call needs. */
  propertyId: string;
  displayName: string;
  /** Owning account's label, so a picker can group by account. */
  accountName: string;
}

/**
 * Flattens accountSummaries into a single property list.
 *
 * Paginated: an agency Google account can easily exceed the 200-item default,
 * and silently showing the first page would make properties "disappear".
 */
export async function listProperties(accessToken: string): Promise<GaProperty[]> {
  const out: GaProperty[] = [];
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({ pageSize: "200" });
    if (pageToken) params.set("pageToken", pageToken);

    const res = await fetch(
      `https://analyticsadmin.googleapis.com/v1beta/accountSummaries?${params.toString()}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!res.ok) await raiseForStatus(res, "Property list");

    const data = (await res.json()) as {
      accountSummaries?: {
        displayName?: string;
        propertySummaries?: { property?: string; displayName?: string }[];
      }[];
      nextPageToken?: string;
    };

    for (const account of data.accountSummaries ?? []) {
      for (const property of account.propertySummaries ?? []) {
        if (!property.property) continue;
        out.push({
          propertyId: property.property,
          displayName: property.displayName ?? property.property,
          accountName: account.displayName ?? "",
        });
      }
    }
    pageToken = data.nextPageToken;
  } while (pageToken);

  return out;
}

// ─── Data API: runReport ────────────────────────────────────────────────────

export interface RunReportRequest {
  dateRanges: { startDate: string; endDate: string }[];
  dimensions?: { name: string }[];
  metrics: { name: string }[];
  orderBys?: unknown[];
  limit?: number;
  dimensionFilter?: unknown;
  keepEmptyRows?: boolean;
}

export interface RunReportResponse {
  dimensionHeaders?: { name?: string }[];
  metricHeaders?: { name?: string; type?: string }[];
  rows?: { dimensionValues?: { value?: string }[]; metricValues?: { value?: string }[] }[];
  totals?: { metricValues?: { value?: string }[] }[];
  rowCount?: number;
}

/** True when a 400 names a metric/dimension GA4 does not recognise. */
export function isUnknownFieldError(err: unknown): boolean {
  return (
    err instanceof Error &&
    /did not match|not a valid|unrecognized|INVALID_ARGUMENT/i.test(err.message)
  );
}

export async function runReport(
  accessToken: string,
  propertyId: string,
  body: RunReportRequest,
): Promise<RunReportResponse> {
  // propertyId already carries the "properties/" prefix from the Admin API.
  const res = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/${encodeURI(propertyId)}:runReport`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) await raiseForStatus(res, "runReport");
  return (await res.json()) as RunReportResponse;
}
