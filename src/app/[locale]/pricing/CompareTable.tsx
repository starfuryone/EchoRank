// The "Free vs paid" table on /pricing. A SERVER component: static markup over
// comparisonTable(), no state. The header row is sticky and the first column
// pinned inside a bounded scroll box, so on a 375 px screen the plan columns
// scroll sideways inside the box while the page itself never scrolls
// horizontally.

import { PLAN_CONFIGS } from "@/lib/plan-config";
import type { CompareCell, CompareTable as Table } from "@/lib/pricing-page/compare";
import type { PricingPageCopy } from "@/lib/pricing-page/copy";
import p from "./pricing.module.css";

function Cell({ cell, copy }: { cell: CompareCell | undefined; copy: PricingPageCopy }) {
  if (!cell || cell.kind === "no") {
    return (
      <td className={p.no}>
        <span aria-hidden="true">—</span>
        <span className={p.sr}>{copy.no}</span>
      </td>
    );
  }
  if (cell.kind === "yes") {
    return (
      <td className={p.yes}>
        <span aria-hidden="true">✓</span>
        <span className={p.sr}>{copy.yes}</span>
      </td>
    );
  }
  return <td>{cell.href ? <a href={cell.href}>{cell.text}</a> : cell.text}</td>;
}

export function CompareTable({ table, copy }: { table: Table; copy: PricingPageCopy }) {
  return (
    <>
      <div className={p.scroll} role="region" aria-label={copy.compareH2} tabIndex={0} data-testid="compare-scroll">
        <table className={p.table} data-testid="compare-table">
          <thead>
            <tr>
              <th scope="col" className={p.first}>
                {copy.featureHead}
              </th>
              <th scope="col">
                {copy.freeHead}
                <span className={p.colSub}>{copy.freeSub}</span>
              </th>
              {table.plans.map((plan) => (
                <th scope="col" key={plan} data-plan={plan}>
                  {PLAN_CONFIGS[plan].name}
                </th>
              ))}
            </tr>
          </thead>
          {table.groups.map((g) => (
            <tbody key={g.id} data-group={g.id}>
              <tr className={p.group}>
                <th scope="colgroup" colSpan={table.plans.length + 2} className={p.first}>
                  {g.title}
                </th>
              </tr>
              {g.rows.map((r) => (
                <tr key={r.id} data-row={r.id}>
                  <th scope="row" className={p.first}>
                    {r.label}
                  </th>
                  <Cell cell={r.free} copy={copy} />
                  {table.plans.map((plan) => (
                    <Cell key={plan} cell={r.plans[plan]} copy={copy} />
                  ))}
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </div>
      <p className={p.hint}>{copy.scrollHint}</p>
    </>
  );
}
