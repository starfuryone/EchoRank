// The company behind Echorank, as shown in every public footer: the React
// footers render <CompanyLine /> (src/components/brand/CompanyLine.tsx), the
// standalone HTML pages get it from withCompanyLine() in their route handler.
// Change it here only. Legal pages state it in their own text and are not
// touched by this.
//
// Dependency-free: Client Components import it.

export const COMPANY = {
  name: "ChatLogic Insights Ltd",
  jurisdiction: "England and Wales",
  number: "15593166",
  registeredOffice: "82a James Carter Road, Mildenhall, IP28 7DE, United Kingdom",
} as const;

// An array join, not `template` + `template`: the production minifier folded
// that concatenation and dropped the " · " between the number and the office
// (seen in a next build on 2026-11-07; the unminified tests could not see it).
export const COMPANY_LINE = [
  COMPANY.name,
  `Registered in ${COMPANY.jurisdiction}, no. ${COMPANY.number}`,
  `Registered office: ${COMPANY.registeredOffice}`,
].join(" · ");

/** Class shared by the React and HTML renderings (styled in globals.css). */
export const COMPANY_LINE_CLASS = "er-company-line";

// Inline style for the standalone pages, which do not load globals.css. A full
// row in a wrapping flex footer, an ordinary block anywhere else.
const INLINE_STYLE =
  "flex:0 0 100%;width:100%;margin:12px 0 0;font-size:12px;line-height:1.5;" +
  "letter-spacing:normal;text-transform:none;opacity:.85";

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export const COMPANY_LINE_HTML = `<p class="${COMPANY_LINE_CLASS}" style="${INLINE_STYLE}">${escapeHtml(COMPANY_LINE)}</p>`;

/**
 * Adds the company line to a standalone page: inside the footer's content
 * container (the last </div> before </footer>), so it lines up with the rest
 * of the footer. Returns the page unchanged if it has no such footer;
 * tests/company-line.test.ts fails any standalone page that ends up without it.
 */
export function withCompanyLine(html: string): string {
  const end = html.lastIndexOf("</footer>");
  if (end < 0) return html;
  const div = html.lastIndexOf("</div>", end);
  const open = html.lastIndexOf("<footer", end);
  const at = div > open ? div : end;
  return `${html.slice(0, at)}${COMPANY_LINE_HTML}\n${html.slice(at)}`;
}
