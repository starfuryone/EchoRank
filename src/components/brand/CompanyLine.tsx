import { COMPANY_LINE, COMPANY_LINE_CLASS } from "@/lib/brand/company";

/** The company identification line for public footers (src/lib/brand/company.ts). */
export function CompanyLine() {
  return <p className={COMPANY_LINE_CLASS}>{COMPANY_LINE}</p>;
}
