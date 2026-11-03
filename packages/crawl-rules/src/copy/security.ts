import type { RuleCopy } from "../types";

export const COPY: Record<string, RuleCopy> = {
  "security.http_url": {
    name: "Page served over HTTP",
    description: "The page is served over plain HTTP, without encryption. Browsers label it \"Not secure\", and HTTPS is a ranking signal.",
    howToFix: "Serve the site over HTTPS and 301-redirect every http:// URL to its https:// equivalent.",
  },
  "security.mixed_content": {
    name: "Mixed content",
    description: "This HTTPS page loads resources (images, scripts, styles, frames) over http://. Browsers block or warn about them, which can break the page.",
    howToFix: "Load every resource over https://, or from your own domain with relative URLs.",
  },
  "security.form_on_http": {
    name: "Form submits over HTTP",
    description: "A form on the page submits to an http:// URL, so whatever the visitor types travels unencrypted. Browsers warn before submitting it.",
    howToFix: "Point the form's action at an https:// URL.",
  },
  "security.unsafe_target_blank": {
    name: "External link opens without noopener",
    description: "A link opens another site in a new tab without rel=\"noopener\". Older browsers let the opened page control yours (\"reverse tabnabbing\").",
    howToFix: "Add rel=\"noopener\" (or rel=\"noopener noreferrer\") to links with target=\"_blank\".",
  },
  "security.missing_hsts": {
    name: "Missing HSTS header",
    description: "The HTTPS response has no Strict-Transport-Security header, so a visitor's first request can still be downgraded to HTTP.",
    howToFix: "Send Strict-Transport-Security: max-age=31536000; includeSubDomains once the whole site works over HTTPS.",
  },
  "security.missing_csp": {
    name: "Missing Content-Security-Policy",
    description: "The response has no Content-Security-Policy header, the main browser defence against injected scripts.",
    howToFix: "Add a Content-Security-Policy. Start in report-only mode to see what a strict policy would block.",
  },
  "security.missing_x_content_type_options": {
    name: "Missing X-Content-Type-Options",
    description: "The response lacks X-Content-Type-Options: nosniff, so browsers may guess a file's type and run something that should not run.",
    howToFix: "Send X-Content-Type-Options: nosniff on every response.",
  },
  "security.missing_x_frame_options": {
    name: "Missing clickjacking protection",
    description: "Neither X-Frame-Options nor a CSP frame-ancestors rule stops other sites from framing this page (clickjacking).",
    howToFix: "Send X-Frame-Options: SAMEORIGIN, or Content-Security-Policy: frame-ancestors 'self'.",
  },
  "security.missing_referrer_policy": {
    name: "Missing Referrer-Policy",
    description: "The response sets no Referrer-Policy, leaving how much of the URL is shared with other sites to the browser default.",
    howToFix: "Send Referrer-Policy: strict-origin-when-cross-origin, or a stricter policy.",
  },
  "security.protocol_relative_resource": {
    name: "Protocol-relative resource URL",
    description: "The page loads resources with //host/path URLs. On HTTPS they work, but the pattern is obsolete and loads over HTTP wherever the page itself is HTTP.",
    howToFix: "Use explicit https:// URLs.",
  },
  "security.bad_content_type": {
    name: "HTML served with the wrong Content-Type",
    description: "The page is HTML, but the Content-Type header is missing or names another type. Browsers and crawlers may not render it as a web page.",
    howToFix: "Send Content-Type: text/html; charset=utf-8 for HTML pages.",
  },
};
