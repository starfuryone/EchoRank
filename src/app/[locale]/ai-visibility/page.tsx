// app/[locale]/ai-visibility/page.tsx — AI Visibility landing + free audit widget

import type { Metadata } from 'next';
import { AuditWidget } from '@/components/AuditWidget';

export const metadata: Metadata = {
  title: 'AI Visibility — EchoRank360',
  description:
    'Track whether ChatGPT, Claude, Gemini and Perplexity recommend your business. Prompt tracking, lost-recommendation alerts and an AI Trust Score for $29/month.',
};

const PROMPTS = [
  'best CRM for small agencies',
  'accounting software freelancers actually use',
  'top AI visibility tools 2026',
];

export default function AIVisibilityPage() {
  return (
    <main className="av">
      <section className="av-hero">
        <div className="av-hero-copy">
          <p className="av-eyebrow">AI Visibility · $29/mo</p>
          <h1>
            When someone asks ChatGPT for a recommendation,
            <span className="av-gold"> are you in the answer?</span>
          </h1>
          <p className="av-sub">
            Millions of buying decisions now start as a prompt, not a search.
            EchoRank360 tracks the prompts that matter to your business, alerts
            you the moment an AI stops recommending you, and scores your
            standing across the major assistants.
          </p>
          <AuditWidget />
          <p className="av-engines">
            Tracks answers from ChatGPT · Claude · Gemini · Perplexity
          </p>
        </div>

        <div className="av-answer" aria-label="Example of a tracked AI answer">
          <div className="av-answer-prompt">
            <span className="av-answer-q">Q</span>
            “best accounting software for freelancers”
          </div>
          <div className="av-answer-body">
            <p className="av-line av-d1">Here are the tools freelancers rate highest:</p>
            <p className="av-line av-d2">1. LedgerKit — strong invoicing</p>
            <p className="av-line av-d3 av-you">
              2. <strong>Your brand</strong> — best value for solo work
              <span className="av-pos">↑ #2 this week</span>
            </p>
            <p className="av-line av-d4">3. Countable — good bank sync</p>
            <span className="av-cursor" aria-hidden="true" />
          </div>
          <div className="av-answer-foot">
            <span className="av-chip av-chip-alert">⚠ Dropped from Gemini answers — Jul 9</span>
            <span className="av-chip">Trust Score 74</span>
          </div>
        </div>
      </section>

      <section className="av-band">
        <h2>The new search results have no page two</h2>
        <p>
          An AI answer names three or four businesses. Everyone else is
          invisible — and nothing tells you when you fall out. Rankings you
          could watch in Google happen silently inside models. AI Visibility
          makes that layer observable.
        </p>
      </section>

      <section className="av-features" id="how">
        <h2>What $29 a month watches for you</h2>
        <div className="av-grid">
          <article>
            <h3>Answer tracking</h3>
            <p>
              We run your tracked prompts against the major assistants every
              week and record exactly how each one answers — who gets named,
              in what order, and with what reasoning.
            </p>
          </article>
          <article>
            <h3>Prompt trends</h3>
            <p>
              A sparkline per prompt shows your mention rate over time, so a
              slow slide is visible weeks before it costs you customers.
            </p>
          </article>
          <article>
            <h3>Lost-recommendation alerts</h3>
            <p>
              The moment you drop out of an answer you used to appear in, you
              get an email digest naming the prompt, the assistant, and who
              replaced you.
            </p>
          </article>
          <article>
            <h3>AI Trust Score</h3>
            <p>
              One number, refreshed on schedule, summarizing how consistently
              AIs recommend you across your prompt set. Watch it respond as
              you improve your presence.
            </p>
          </article>
        </div>
      </section>

      <section className="av-band av-band-alt">
        <h2>Track the prompts your customers actually type</h2>
        <ul className="av-prompts">
          {PROMPTS.map((p) => (
            <li key={p}>“{p}”</li>
          ))}
          <li className="av-prompts-more">…up to 25 prompts of your own</li>
        </ul>
      </section>

      <section className="av-pricing" id="pricing">
        <div className="av-price-card">
          <p className="av-eyebrow">AI Visibility</p>
          <p className="av-price">$29<span>/month</span></p>
          <ul>
            <li>1 brand</li>
            <li>25 tracked prompts</li>
            <li>Weekly answer refresh</li>
            <li>Lost-recommendation alerts</li>
            <li>AI Trust Score</li>
            <li>ChatGPT, Claude, Gemini &amp; Perplexity coverage</li>
          </ul>
          <a className="av-btn av-btn-gold av-btn-block" href="/register?plan=ai_visibility">
            Start tracking — $29/mo
          </a>
          <p className="av-fine">
            Cancel anytime. Need more brands, seats or nightly refresh?{' '}
            <a href="/#pricing">Compare plans</a>.
          </p>
        </div>
      </section>

      <section className="av-faq">
        <h2>Questions</h2>
        <details>
          <summary>Which AI assistants do you track?</summary>
          <p>ChatGPT, Claude, Gemini and Perplexity. Coverage expands as new assistants gain real usage.</p>
        </details>
        <details>
          <summary>How often are answers refreshed?</summary>
          <p>Weekly on this plan. Higher plans refresh nightly.</p>
        </details>
        <details>
          <summary>Can I change my tracked prompts?</summary>
          <p>Yes — edit your prompt set anytime. Changes apply from the next refresh.</p>
        </details>
        <details>
          <summary>Does this include review management?</summary>
          <p>No. AI Visibility is the tracking layer only. Review and reputation tools are on Growth and Agency plans.</p>
        </details>
      </section>

      <section className="av-final">
        <h2>Find out what the AIs say about you</h2>
        <a className="av-btn av-btn-gold" href="/register?plan=ai_visibility">
          Start tracking — $29/mo
        </a>
      </section>

      <style>{css}</style>
    </main>
  );
}

const css = `
.av {
  --gold: #d4a843;
  --gold-soft: rgba(212, 168, 67, 0.14);
  background: var(--bg, #0c0d10);
  color: #e9e6df;
  line-height: 1.6;
}
.av h1, .av h2, .av h3 { line-height: 1.15; letter-spacing: -0.015em; margin: 0 0 0.6em; }
.av h1 { font-size: clamp(2rem, 4.5vw, 3.4rem); font-weight: 750; }
.av h2 { font-size: clamp(1.5rem, 3vw, 2.2rem); font-weight: 700; }
.av h3 { font-size: 1.05rem; color: var(--gold); font-weight: 650; }
.av section { padding: clamp(3rem, 7vw, 6rem) clamp(1.25rem, 6vw, 6rem); }
.av-gold { color: var(--gold); }
.av-eyebrow {
  color: var(--gold); font-size: 0.8rem; letter-spacing: 0.14em;
  text-transform: uppercase; font-weight: 600; margin-bottom: 1rem;
}
.av-sub { max-width: 34rem; color: #b8b4aa; font-size: 1.05rem; }
.av-hero {
  display: grid; grid-template-columns: 1.1fr 0.9fr;
  gap: clamp(2rem, 5vw, 4rem); align-items: center; min-height: 70vh;
}
.av-engines { font-size: 0.85rem; color: #8b877e; }
.av-btn {
  display: inline-block; padding: 0.8rem 1.5rem; border-radius: 10px;
  font-weight: 650; text-decoration: none; font-size: 0.95rem;
  transition: transform 120ms ease, background 120ms ease;
}
.av-btn:focus-visible { outline: 2px solid var(--gold); outline-offset: 3px; }
.av-btn-gold { background: var(--gold); color: #17140c; border: 0; cursor: pointer; }
.av-btn-gold:hover { transform: translateY(-1px); }
.av-btn-ghost { border: 1px solid var(--surface2, #2a2c33); color: #e9e6df; }
.av-btn-ghost:hover { background: var(--surface, #16181d); }
.av-btn-block { display: block; text-align: center; margin-top: 1.5rem; width: 100%; }
.av-answer {
  background: var(--surface, #16181d);
  border: 1px solid var(--surface2, #2a2c33);
  border-radius: 16px; padding: 1.5rem;
  box-shadow: 0 24px 60px rgba(0,0,0,0.45);
}
.av-answer-prompt {
  display: flex; gap: 0.6rem; align-items: baseline;
  color: #b8b4aa; font-size: 0.92rem; padding-bottom: 0.9rem;
  border-bottom: 1px solid var(--surface2, #2a2c33); margin-bottom: 0.9rem;
}
.av-answer-q {
  color: var(--gold); font-weight: 700; font-size: 0.8rem;
  border: 1px solid var(--gold); border-radius: 6px; padding: 0 0.4rem;
}
.av-line { margin: 0.45rem 0; font-size: 0.95rem; opacity: 0; animation: av-in 400ms ease forwards; }
.av-d1 { animation-delay: 200ms; } .av-d2 { animation-delay: 700ms; }
.av-d3 { animation-delay: 1200ms; } .av-d4 { animation-delay: 1700ms; }
.av-you {
  background: var(--gold-soft); border-left: 3px solid var(--gold);
  padding: 0.35rem 0.6rem; border-radius: 6px;
}
.av-pos { color: var(--gold); font-size: 0.8rem; margin-left: 0.5rem; font-weight: 600; }
.av-cursor {
  display: inline-block; width: 8px; height: 1em; background: var(--gold);
  vertical-align: text-bottom; animation: av-blink 1s steps(1) infinite;
}
@keyframes av-in { to { opacity: 1; } }
@keyframes av-blink { 50% { opacity: 0; } }
@media (prefers-reduced-motion: reduce) {
  .av-line { animation: none; opacity: 1; }
  .av-cursor { animation: none; }
}
.av-answer-foot { display: flex; gap: 0.5rem; flex-wrap: wrap; margin-top: 1rem; }
.av-chip {
  font-size: 0.78rem; padding: 0.25rem 0.65rem; border-radius: 999px;
  border: 1px solid var(--surface2, #2a2c33); color: #b8b4aa;
}
.av-chip-alert { border-color: #a4552f; color: #e0a184; }
.av-band { text-align: center; }
.av-band p { max-width: 40rem; margin: 0 auto; color: #b8b4aa; }
.av-band-alt { background: var(--surface, #16181d); }
.av-features h2 { text-align: center; margin-bottom: 2.5rem; }
.av-grid {
  display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
  gap: 1rem;
}
.av-grid article {
  background: var(--surface, #16181d);
  border: 1px solid var(--surface2, #2a2c33);
  border-radius: 14px; padding: 1.5rem;
}
.av-grid p { color: #b8b4aa; font-size: 0.93rem; margin: 0; }
.av-prompts { list-style: none; padding: 0; margin: 1.5rem auto 0; max-width: 34rem; }
.av-prompts li {
  border: 1px solid var(--surface2, #2a2c33); border-radius: 999px;
  padding: 0.55rem 1.1rem; margin: 0.5rem 0; font-size: 0.95rem;
}
.av-prompts-more { color: #8b877e; border-style: dashed !important; }
.av-pricing { display: flex; justify-content: center; }
.av-price-card {
  background: var(--surface, #16181d);
  border: 1px solid var(--gold); border-radius: 18px;
  padding: 2.25rem; max-width: 24rem; width: 100%;
}
.av-price { font-size: 3rem; font-weight: 750; margin: 0 0 1rem; }
.av-price span { font-size: 1rem; color: #8b877e; font-weight: 400; }
.av-price-card ul { list-style: none; padding: 0; margin: 0; }
.av-price-card li {
  padding: 0.45rem 0 0.45rem 1.4rem; position: relative; font-size: 0.95rem;
  border-bottom: 1px solid var(--surface2, #2a2c33);
}
.av-price-card li::before { content: '✓'; position: absolute; left: 0; color: var(--gold); }
.av-fine { font-size: 0.8rem; color: #8b877e; margin-top: 0.9rem; }
.av-fine a { color: var(--gold); }
.av-faq { max-width: 44rem; margin: 0 auto; }
.av-faq details { border-bottom: 1px solid var(--surface2, #2a2c33); padding: 0.9rem 0; }
.av-faq summary { cursor: pointer; font-weight: 600; }
.av-faq summary:focus-visible { outline: 2px solid var(--gold); outline-offset: 3px; }
.av-faq p { color: #b8b4aa; font-size: 0.95rem; }
.av-final { text-align: center; }
/* ---- Audit widget ---- */
.av-audit { margin: 1.75rem 0 1rem; max-width: 32rem; }
.av-audit-label { display: block; font-weight: 650; margin-bottom: 0.6rem; }
.av-audit-row { display: flex; gap: 0.6rem; flex-wrap: wrap; }
.av-audit-row input {
  flex: 1; min-width: 220px; padding: 0.8rem 1rem; border-radius: 10px;
  border: 1px solid var(--surface2, #2a2c33);
  background: var(--surface, #16181d); color: #e9e6df; font-size: 0.95rem;
}
.av-audit-row input:focus-visible { outline: 2px solid var(--gold); outline-offset: 2px; }
.av-audit-row button:disabled { opacity: 0.55; cursor: not-allowed; }
.av-audit-note { color: #b8b4aa; font-size: 0.85rem; margin-top: 0.6rem; }
.av-audit-err { color: #e0a184; font-size: 0.9rem; margin-top: 0.6rem; }
.av-audit-fine { color: #8b877e; font-size: 0.78rem; margin-top: 0.5rem; }
.av-audit-result {
  background: var(--surface, #16181d);
  border: 1px solid var(--gold); border-radius: 14px; padding: 1.5rem;
}
.av-audit-headline { font-size: 1.05rem; margin: 0 0 0.9rem; }
.av-audit-engines { list-style: none; padding: 0; margin: 0 0 0.9rem; display: flex; gap: 0.5rem; flex-wrap: wrap; }
.av-audit-engines li {
  font-size: 0.82rem; padding: 0.25rem 0.7rem; border-radius: 999px;
  border: 1px solid var(--surface2, #2a2c33);
}
.av-audit-engines .av-hit { color: var(--gold); border-color: var(--gold); }
.av-audit-engines .av-miss { color: #8b877e; }
.av-audit-sample {
  margin: 0 0 0.9rem; padding: 0.7rem 1rem; font-size: 0.88rem; color: #b8b4aa;
  border-left: 3px solid var(--surface2, #2a2c33); font-style: italic;
}
.av-audit-upsell { color: #b8b4aa; font-size: 0.9rem; }
.av-audit-again {
  display: block; text-align: center; margin-top: 0.7rem;
  color: #8b877e; font-size: 0.85rem;
}
@media (max-width: 860px) {
  .av-hero { grid-template-columns: 1fr; min-height: unset; }
}
`;
