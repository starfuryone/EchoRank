import { createHmac, randomBytes } from "crypto";

const BASE = process.env.MATRIX_INTERNAL_URL ?? "http://127.0.0.1:8008";
const SECRET = process.env.MATRIX_REGISTRATION_SECRET;

export interface ProvisionResult {
  mxid: string;
  password: string; // display once, never stored
}

export function derivePassword(): string {
  return randomBytes(24).toString("base64url");
}

export async function usernameAvailable(username: string): Promise<boolean> {
  const res = await fetch(
    `${BASE}/_matrix/client/v3/register/available?username=${encodeURIComponent(username)}`
  );
  return res.ok; // 400 M_USER_IN_USE when taken
}

export async function provisionMatrixAccount(
  username: string,
  password: string
): Promise<ProvisionResult> {
  if (!SECRET) throw new Error("MATRIX_REGISTRATION_SECRET not configured");
  if (!/^[a-z0-9._=/-]+$/.test(username)) throw new Error("invalid username");

  // 1. fresh nonce (single-use, expires — never retry with a stale one)
  const nonceRes = await fetch(`${BASE}/_synapse/admin/v1/register`);
  if (!nonceRes.ok) throw new Error(`nonce fetch failed: ${nonceRes.status}`);
  const { nonce } = (await nonceRes.json()) as { nonce: string };

  // 2. HMAC-SHA1 over nonce\0user\0password\0notadmin (literal NUL delimiters)
  const mac = createHmac("sha1", SECRET)
    .update(nonce).update("\x00")
    .update(username).update("\x00")
    .update(password).update("\x00")
    .update("notadmin")
    .digest("hex");

  // 3. register
  const res = await fetch(`${BASE}/_synapse/admin/v1/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nonce, username, password, admin: false, mac }),
  });
  const body = (await res.json()) as { user_id?: string; error?: string };
  if (!res.ok || !body.user_id) {
    throw new Error(`synapse register failed ${res.status}: ${body.error ?? "unknown"}`);
  }
  // discard access_token — we only keep the mxid
  return { mxid: body.user_id, password };
}

export async function deactivateMatrixAccount(mxid: string): Promise<void> {
  const token = process.env.MATRIX_ADMIN_TOKEN;
  if (!token) throw new Error("MATRIX_ADMIN_TOKEN not configured");
  const res = await fetch(
    `${BASE}/_synapse/admin/v1/deactivate/${encodeURIComponent(mxid)}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ erase: false }),
    }
  );
  if (!res.ok) throw new Error(`deactivate failed: ${res.status}`);
}
