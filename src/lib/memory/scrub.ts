// src/lib/memory/scrub.ts
//
// PII scrub before a memory add is queued. The sidecar scrubs again
// (av-service memory/scrub.py) and drops any extracted fact that still carries
// an email or a phone; this copy exists because the job sits in Redis until
// the worker takes it, and a brief's raw text has no business there.
// Same rules as the Python: emails, URL query strings, card-like digit runs,
// phone numbers (8+ digits), with dates and year ranges kept. The cases live
// in tests/memory-client.test.ts and av-service tests/test_memory.py; change
// one side and the other's cases tell you what moved.

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const URL_QUERY_RE = /(https?:\/\/[^\s?#]+)[?#][^\s]*/gi;
const CARD_RE = /\b(?:\d[ -]?){12,18}\d\b/g;
const PHONE_RE = /(?<![\w])(?:\+|00)?\d{1,3}?[\s.-]?\(?\d{2,4}\)?(?:[\s.-]?\d{2,4}){2,4}(?![\w])/g;
const DATE_RE = /^\s*(?:\d{4}[-./]\d{1,2}[-./]\d{1,2}|\d{1,2}[-./]\d{1,2}[-./]\d{4}|\d{4}\s*[-–]\s*\d{4})\s*$/;

export const REDACTED = {
  email: "[email removed]",
  phone: "[phone removed]",
  card: "[number removed]",
} as const;

const digits = (s: string) => (s.match(/\d/g) ?? []).length;

export function scrubForMemory(text: string): string {
  if (!text) return text;
  return text
    .replace(EMAIL_RE, REDACTED.email)
    .replace(URL_QUERY_RE, "$1")
    .replace(CARD_RE, REDACTED.card)
    .replace(PHONE_RE, (m) => (digits(m) < 8 || DATE_RE.test(m) ? m : REDACTED.phone));
}
