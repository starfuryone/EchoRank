"use client";

// The free AI Visibility Check's result, in its two depths:
//   - SnapshotPreviewView: the pre-email view (mention rates, competitor names);
//   - SnapshotFullView:    everything, behind the email gate and on the share page.
// Both render data only; fetching and the gate live in SnapshotCheck.tsx.

import { useState } from "react";
import type { SnapshotCopy } from "@/lib/snapshot/copy";
import { trackHref } from "@/lib/snapshot/copy";
import { CHATGPT_GUIDE_ANCHORS, CHATGPT_GUIDE_HREF } from "@/lib/chatgpt-guide-link";
import {
  ENGINE_LABEL,
  type EngineSummary,
  type SnapshotPreview,
  type SnapshotReport,
} from "@/lib/snapshot/types";
import st from "./snapshot.module.css";

const pct = (r: number | null) => (r === null ? "—" : `${Math.round(r * 100)}%`);

function Rates({ engines, c, withCitation }: { engines: EngineSummary[]; c: SnapshotCopy; withCitation: boolean }) {
  return (
    <div className={st.rates}>
      {engines.map((e) => (
        <div className={st.rate} key={e.engine}>
          <div className={st.rateEngine}>{ENGINE_LABEL[e.engine]}</div>
          {e.answered ? (
            <>
              <div className={st.rateValue}>{pct(e.mentionRate)}</div>
              <div className={st.rateLabel}>
                {c.result.mentionRate} · {e.mentioned}/{e.answered}
              </div>
              {withCitation && (
                <div className={st.rateSub}>
                  {pct(e.citationRate)} {c.result.citationRate}
                </div>
              )}
            </>
          ) : (
            <div className={st.rateLabel}>{c.result.notAnswered}</div>
          )}
        </div>
      ))}
    </div>
  );
}

export function SnapshotPreviewView({ p, c, cached }: { p: SnapshotPreview; c: SnapshotCopy; cached?: boolean }) {
  return (
    <>
      {p.notMentioned && <p className={st.lead}>{c.result.notMentionedLead}</p>}
      <Rates engines={p.engines} c={c} withCitation={false} />
      <h3 className={st.h3}>{c.result.competitorsTitle}</h3>
      {p.competitors.length ? (
        <ul className={st.chips}>
          {p.competitors.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      ) : (
        <p className={st.muted}>{c.result.competitorsNone}</p>
      )}
      <p className={st.muted} style={{ marginTop: 14 }}>
        {c.result.sourcesCount.replace("{n}", String(p.sourceCount))}
      </p>
      {cached && <p className={st.fine}>{c.result.cached}</p>}
      {p.capped && <p className={st.fine}>{c.result.capped}</p>}
    </>
  );
}

export function ShareLink({ url, expiresAt, c, locale }: { url: string; expiresAt: string | null; c: SnapshotCopy; locale: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div>
      <h3 className={st.h3}>{c.full.share}</h3>
      <div className={st.share}>
        <input readOnly value={url} aria-label={c.full.share} onFocus={(e) => e.currentTarget.select()} />
        <button
          type="button"
          className={`${st.btn} ${st.btnGhost}`}
          style={{ height: 40 }}
          onClick={() => {
            navigator.clipboard?.writeText(url).then(() => setCopied(true), () => undefined);
          }}
        >
          {copied ? c.full.copied : c.full.copy}
        </button>
      </div>
      {expiresAt && (
        <p className={st.fine}>
          {c.full.expires.replace("{date}", new Date(expiresAt).toLocaleDateString(locale, { dateStyle: "long" }))}
        </p>
      )}
    </div>
  );
}

export function SnapshotFullView({ r, c }: { r: SnapshotReport; c: SnapshotCopy }) {
  const notMentioned = r.engines.some((e) => e.answered) && r.engines.every((e) => !e.answered || e.mentioned === 0);
  const engines = r.engines.map((e) => e.engine);
  return (
    <>
      {notMentioned && <p className={st.lead}>{c.result.notMentionedLead}</p>}
      <Rates engines={r.engines} c={c} withCitation />

      <h3 className={st.h3}>{c.result.competitorsTitle}</h3>
      {r.competitors.length ? (
        <ul className={st.chips}>
          {r.competitors.map((x) => (
            <li key={x.name}>
              {x.name}
              <span>×{x.count}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className={st.muted}>{c.result.competitorsNone}</p>
      )}

      <h3 className={st.h3}>{c.full.promptsTitle}</h3>
      <div className={st.tableWrap}>
        <table className={st.table}>
          <thead>
            <tr>
              <th scope="col">{c.full.prompt}</th>
              {engines.map((e) => (
                <th scope="col" key={e}>
                  {ENGINE_LABEL[e]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {r.prompts.map((p) => (
              <tr key={p.index}>
                <td>
                  <span className={st.kind}>{c.full.kinds[p.kind]}</span>
                  {p.text}
                </td>
                {engines.map((e) => {
                  const cell = p.results[e];
                  if (!cell || cell.error) return <td key={e} className={st.no}>{c.full.error}</td>;
                  return (
                    <td key={e}>
                      <span className={cell.mentioned ? st.yes : st.no}>{cell.mentioned ? c.full.yes : c.full.no}</span>
                      {cell.cited && <span className={st.cited}>{c.full.cited}</span>}
                      {cell.competitors.length > 0 && (
                        <span className={st.cellMeta}>
                          {c.full.competitorsIn}: {cell.competitors.join(", ")}
                        </span>
                      )}
                      {cell.excerpt && (
                        <details className={st.excerpt}>
                          <summary>{c.full.showExcerpt}</summary>
                          <p>{cell.excerpt}</p>
                        </details>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3 className={st.h3}>{c.full.sourcesDecided}</h3>
      {r.sources.length ? (
        <div className={st.tableWrap}>
          <table className={st.table}>
            <thead>
              <tr>
                <th scope="col">{c.full.colSource}</th>
                <th scope="col">{c.full.colTimes}</th>
                <th scope="col">{c.full.colSupported}</th>
                <th scope="col">{c.full.colYou}</th>
              </tr>
            </thead>
            <tbody>
              {r.sources.map((s) => (
                <tr key={s.domain}>
                  <td>{s.domain}</td>
                  <td>{s.timesCited}</td>
                  <td>{s.competitors.map((x) => `${x.name} ×${x.count}`).join(", ") || "—"}</td>
                  <td className={s.userCited ? st.yes : st.no}>{s.userCited ? c.full.yesShort : c.full.noShort}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className={st.muted}>{c.full.sourcesNone}</p>
      )}

      {r.citationGap && (
        <>
          <h3 className={st.h3}>{c.gap.title}</h3>
          {r.citationGap.length ? (
            <>
              <p className={st.muted}>{c.gap.lead}</p>
              <div className={st.tableWrap}>
                <table className={st.table} data-testid="citation-gap">
                  <thead>
                    <tr>
                      <th scope="col">{c.gap.colSource}</th>
                      <th scope="col">{c.gap.colType}</th>
                      <th scope="col">{c.gap.colTimes}</th>
                      <th scope="col">{c.gap.colNamed}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.citationGap.map((g) => (
                      <tr key={g.domain}>
                        <td>{g.domain}</td>
                        <td>{c.gap.types[g.type]}</td>
                        <td>{g.count}</td>
                        <td>{g.competitors.join(", ") || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className={st.fine}>{c.gap.more}</p>
            </>
          ) : (
            <p className={st.muted}>{c.gap.none}</p>
          )}
        </>
      )}

      <h3 className={st.h3}>{c.todo.title}</h3>
      {r.actions.length ? (
        <>
          <p className={st.muted}>{c.todo.lead}</p>
          <ol className={st.todo}>
            {r.actions.map((a) => (
              <li key={a.domain}>
                <span className={st.todoDomain}>{a.domain}</span>
                <span className={st.cellMeta}>
                  {c.todo.types[a.type]} · {a.timesCited} {c.full.timesCited}
                </span>
                <span className={a.action ? st.todoAction : st.cellMeta}>
                  {a.action ? c.todo.actions[a.action] : c.todo.noAction}
                </span>
              </li>
            ))}
          </ol>
        </>
      ) : (
        <p className={st.muted}>{c.todo.none}</p>
      )}
      {r.capped && <p className={st.fine}>{c.result.capped}</p>}
    </>
  );
}

export function SnapshotUpsell({ c, locale, snapshotId }: { c: SnapshotCopy; locale: string; snapshotId?: string }) {
  return (
    <div className={st.upsell}>
      <h3>{c.upsell.heading}</h3>
      <p>{c.upsell.body}</p>
      <a className={st.btn} href={trackHref(locale, snapshotId)}>
        {c.upsell.cta} →
      </a>
      <span className={st.planLine}>{c.upsell.planLine}</span>
      {/* The guide's section on checking ChatGPT citations over time (same anchor in every language). */}
      <a className={st.planLine} href={`/${locale}${CHATGPT_GUIDE_HREF}#${CHATGPT_GUIDE_ANCHORS.check}`} data-testid="snapshot-guide-link">
        {c.upsell.guideLink} →
      </a>
    </div>
  );
}
