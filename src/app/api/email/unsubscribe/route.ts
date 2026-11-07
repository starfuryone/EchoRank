// One-click unsubscribe from marketing email (RFC 8058). See src/lib/email/unsubscribe.ts.
//
// POST  turns marketing off: a mail client's one-click button (body
//       "List-Unsubscribe=One-Click", no Origin header, which is why the proxy
//       exempts this exact path from its origin check) or the button below.
// GET   shows a page with that button. It never unsubscribes by itself, so a
//       link scanner that follows the URL changes nothing.
//
// The token is the only credential; no cookie is read. Product and billing
// emails are unaffected: they never check marketingConsent.
import { prisma } from "@/lib/prisma";
import { verifyUnsubscribeToken } from "@/lib/email/unsubscribe";
import { UNSUBSCRIBE_COPY, unsubscribeLocale } from "@/lib/email/unsubscribe-copy";
import { logger } from "@/infrastructure/observability/logger";

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

function page(title: string, body: string, status = 200): Response {
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${esc(title)}</title><style>body{font:16px/1.5 system-ui,sans-serif;max-width:32rem;margin:15vh auto;padding:0 16px;color:#181a20;background:#fff}button{font:inherit;padding:.6rem 1.2rem;border:1px solid #181a20;border-radius:6px;background:#181a20;color:#fff;cursor:pointer}p.note{color:#555}</style></head><body>${body}</body></html>`;
  return new Response(html, {
    status,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex" },
  });
}

async function tenantFor(token: string | null) {
  const tenantId = verifyUnsubscribeToken(token);
  if (!tenantId) return null;
  return prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true, defaultLanguage: true } });
}

export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("t");
  const tenant = await tenantFor(token);
  const c = UNSUBSCRIBE_COPY[unsubscribeLocale(tenant?.defaultLanguage)];
  if (!tenant || !token) return page(c.title, `<p>${esc(c.invalid)}</p>`, 400);
  const action = `/api/email/unsubscribe?t=${encodeURIComponent(token)}`;
  return page(
    c.title,
    `<h1>${esc(c.title)}</h1><p>${esc(c.ask)}</p><form method="post" action="${esc(action)}"><button type="submit">${esc(c.button)}</button></form>`,
  );
}

export async function POST(req: Request) {
  const token = new URL(req.url).searchParams.get("t");
  const tenant = await tenantFor(token);
  const c = UNSUBSCRIBE_COPY[unsubscribeLocale(tenant?.defaultLanguage)];
  if (!tenant) return page(c.title, `<p>${esc(c.invalid)}</p>`, 400);
  await prisma.tenant.update({ where: { id: tenant.id }, data: { marketingConsent: false } });
  logger.info({ tenantId: tenant.id }, "marketing email: unsubscribed");
  return page(c.title, `<h1>${esc(c.done)}</h1><p class="note">${esc(c.doneNote)}</p>`);
}
