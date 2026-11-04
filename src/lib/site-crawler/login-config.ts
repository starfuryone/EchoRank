// src/lib/site-crawler/login-config.ts
//
// Forms-based login for the crawler (Phase 4e, crawl.login), verified sites
// only: where the login form is, how to fill it, and how to tell it worked.
// Saved per host in crawl_site_defaults.login with the credentials sealed
// like every other secret ({ enc }), copied (still sealed) onto a crawl that
// asks for it. The UI only ever sees { set: true } for them.

import { z } from "zod";
import type { SecretInput, SecretView, StoredSecret } from "./crawl-config";

export const LOGIN_LIMITS = { urlChars: 2000, selectorChars: 200, credentialChars: 256 } as const;

export interface LoginConfigOf<S> {
  loginUrl: string;
  usernameSelector: string;
  passwordSelector: string;
  submitSelector: string;
  successCheck: { kind: "urlPrefix" | "selector"; value: string };
  username: S;
  password: S;
}
export type LoginInput = LoginConfigOf<SecretInput>;
export type StoredLogin = LoginConfigOf<StoredSecret>;
export type LoginView = LoginConfigOf<SecretView>;
export type RuntimeLogin = LoginConfigOf<string>;

const selector = z.string().trim().min(1).max(LOGIN_LIMITS.selectorChars).refine((s) => !/[\r\n]/.test(s));
const secret = z.union([z.string().min(1).max(LOGIN_LIMITS.credentialChars).refine((s) => !/[\r\n]/.test(s)), z.object({ keep: z.literal(true) })]);

export const LoginInputSchema = z.object({
  loginUrl: z.string().trim().min(1).max(LOGIN_LIMITS.urlChars),
  usernameSelector: selector,
  passwordSelector: selector,
  submitSelector: selector,
  successCheck: z.object({ kind: z.enum(["urlPrefix", "selector"]), value: z.string().trim().min(1).max(LOGIN_LIMITS.urlChars) }),
  username: secret,
  password: secret,
});

/** Patterns of links a logged-in crawl never follows (URL), and of their anchor text. */
export const LOGOUT_URL = /(logout|log-out|signout|sign-out|disconnect)/i;
export const LOGOUT_TEXT = /\b(log ?out|sign ?out|disconnect)\b/i;

export function viewLogin(stored: StoredLogin | null): LoginView | null {
  return stored ? { ...stored, username: { set: true }, password: { set: true } } : null;
}

/** Reason codes the sidecar returns for a failed login, plus the crawler's own. */
export const LOGIN_REASONS = [
  "login_page_unreachable",
  "username_field_not_found",
  "password_field_not_found",
  "submit_not_found",
  "success_check_failed",
  "timeout",
  "sidecar_unavailable",
  "not_verified",
] as const;
export type LoginReason = (typeof LOGIN_REASONS)[number];
