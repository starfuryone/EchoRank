"use client";

// The AI Search setup wizard.
//
// FOUR STEPS, ONE PAID CALL. Brand -> engines -> prompts -> confirm. The
// suggestion request fires once, when the user leaves step 2, and never again
// unless they ask for it: it spends the tenant's AI budget, and a wizard that
// regenerated on every keystroke would be a bill nobody could explain.
//
// THE SUGGESTIONS ARE EDITABLE AND DESELECTABLE, and the user can add their
// own. What arrives from the model is a starting point for someone who knows
// their market better than it does — and a prompt they wrote themselves is
// marked custom so the wizard does not later claim it suggested it.
//
// ENGINE SELECTABILITY IS THE SERVER'S ANSWER. `engines` arrives resolved; this
// component renders the disabled ones with their note and refuses to submit
// them. It never decides for itself which engines exist.

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

interface EngineOption {
  provider: string;
  label: string;
  selectable: boolean;
  supportsSearch: boolean;
  supportsCitations: boolean;
  note: string | null;
}

interface Suggestion {
  text: string;
  category: string;
  intent: string;
  audience: string | null;
  label: string | null;
  score: number;
}

interface DraftPrompt extends Suggestion {
  keep: boolean;
  custom: boolean;
}

type Step = 0 | 1 | 2 | 3;

const STEP_TITLES = ["Your brand", "AI engines", "Questions to track", "Review"];

export function SetupWizard({
  engines,
  promptLimit,
  planName,
}: {
  engines: EngineOption[];
  promptLimit: number;
  planName: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(0);

  const [brand, setBrand] = useState("");
  const [website, setWebsite] = useState("");
  const [industry, setIndustry] = useState("");
  const [country, setCountry] = useState("");
  const [competitors, setCompetitors] = useState("");

  const [selected, setSelected] = useState<string[]>(
    engines.filter((engine) => engine.selectable).map((engine) => engine.provider),
  );

  const [prompts, setPrompts] = useState<DraftPrompt[]>([]);
  const [siteSummary, setSiteSummary] = useState<string | null>(null);
  const [capped, setCapped] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customDraft, setCustomDraft] = useState("");

  const kept = useMemo(() => prompts.filter((prompt) => prompt.keep), [prompts]);

  const brandOk = brand.trim().length > 0;
  // Loose on purpose — the server owns the real rule (registrable domain), and
  // a stricter regex here would reject things the server happily accepts.
  const websiteOk = /\./.test(website.trim()) && !/\s/.test(website.trim());

  const suggest = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/ai-search/wizard/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brand,
          website,
          industry,
          country: country || null,
          competitors: competitors
            .split(",")
            .map((name) => name.trim())
            .filter(Boolean),
        }),
      });
      if (!res.ok) throw new Error("Could not analyse that site.");
      const data = (await res.json()) as {
        suggestions: Suggestion[];
        site: { summary: string; ok: boolean };
        capped: boolean;
      };

      setSiteSummary(data.site.ok ? data.site.summary : null);
      setCapped(data.capped);
      setPrompts(data.suggestions.map((s) => ({ ...s, keep: true, custom: false })));
      setStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }, [brand, website, industry, country, competitors]);

  const finish = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/ai-search/wizard/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brand,
          website,
          industry,
          country: country || null,
          engines: selected,
          competitors: competitors
            .split(",")
            .map((name) => name.trim())
            .filter(Boolean),
          prompts: kept.map((prompt) => ({
            text: prompt.text,
            category: prompt.category,
            intent: prompt.intent,
            audience: prompt.audience,
            // Only a prompt that survived unedited carries the score that
            // ranked it; an edited one is a different question.
            suggestionScore: prompt.custom ? null : prompt.score,
            custom: prompt.custom,
          })),
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(body.message ?? "Could not finish setup.");
      }
      router.push("/visibility?onboarding=1");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setBusy(false);
    }
  }, [brand, website, industry, country, competitors, selected, kept, router]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-semibold text-gray-900">Set up AI Search tracking</h1>
      <p className="mt-1 text-sm text-gray-600">
        We ask AI assistants the questions your buyers ask, and record whether they mention you.
      </p>

      <ol className="mt-6 flex gap-2" aria-label="Progress">
        {STEP_TITLES.map((title, index) => (
          <li
            key={title}
            aria-current={index === step ? "step" : undefined}
            className={`flex-1 rounded-lg px-3 py-2 text-xs font-medium ${
              index === step
                ? "bg-blue-600 text-white"
                : index < step
                  ? "bg-blue-50 text-blue-700"
                  : "bg-gray-100 text-gray-500"
            }`}
          >
            {index + 1}. {title}
          </li>
        ))}
      </ol>

      {error && (
        <p role="alert" className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {step === 0 && (
        <section className="mt-6 space-y-4">
          <Field label="Brand name" hint="Exactly as people write it.">
            <input
              className={inputClass}
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              placeholder="Acme Analytics"
            />
          </Field>
          <Field label="Website" hint="We read your homepage once to understand what you do.">
            <input
              className={inputClass}
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="acme.com"
            />
          </Field>
          <Field label="Industry" hint="Optional, but it sharpens the questions.">
            <input
              className={inputClass}
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              placeholder="Analytics software"
            />
          </Field>
          <Field label="Main market" hint="Two-letter country code. Leave blank if you sell everywhere — we only ask 'near me' questions for businesses with a place.">
            <input
              className={inputClass}
              value={country}
              onChange={(e) => setCountry(e.target.value.toUpperCase().slice(0, 2))}
              placeholder="CH"
            />
          </Field>
          <Field label="Competitors" hint="Comma separated. Used for comparison questions.">
            <input
              className={inputClass}
              value={competitors}
              onChange={(e) => setCompetitors(e.target.value)}
              placeholder="Plausible, Fathom"
            />
          </Field>

          <Nav
            onNext={() => setStep(1)}
            nextDisabled={!brandOk || !websiteOk}
            nextLabel="Choose engines"
          />
        </section>
      )}

      {step === 1 && (
        <section className="mt-6">
          <p className="text-sm text-gray-600">
            We ask each engine the same questions, so you can see where you are strong and where
            you are invisible.
          </p>
          <ul className="mt-4 space-y-2">
            {engines.map((engine) => {
              const id = `engine-${engine.provider}`;
              const checked = selected.includes(engine.provider);
              return (
                <li
                  key={engine.provider}
                  className={`flex items-center gap-3 rounded-xl border p-3 ${
                    engine.selectable ? "border-gray-200 bg-white" : "border-gray-100 bg-gray-50"
                  }`}
                >
                  <input
                    id={id}
                    type="checkbox"
                    className="h-4 w-4 accent-blue-600"
                    disabled={!engine.selectable}
                    checked={checked}
                    onChange={(e) =>
                      setSelected((current) =>
                        e.target.checked
                          ? [...current, engine.provider]
                          : current.filter((p) => p !== engine.provider),
                      )
                    }
                  />
                  <label htmlFor={id} className="flex-1 text-sm">
                    <span
                      className={engine.selectable ? "font-medium text-gray-900" : "text-gray-500"}
                    >
                      {engine.label}
                    </span>
                    {engine.supportsCitations && engine.selectable && (
                      <span className="ml-2 text-xs text-gray-500">cites sources</span>
                    )}
                  </label>
                  {/* Shown rather than hidden: "coming soon" says what is
                      planned, an absent row says the product does not do it. */}
                  {!engine.selectable && (
                    <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs text-gray-600">
                      {engine.note}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>

          <Nav
            onBack={() => setStep(0)}
            onNext={suggest}
            nextDisabled={selected.length === 0 || busy}
            nextLabel={busy ? "Reading your site…" : "Suggest questions"}
          />
        </section>
      )}

      {step === 2 && (
        <section className="mt-6">
          {siteSummary && (
            <p className="rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-600">
              From your homepage: <span className="text-gray-900">{siteSummary}</span>
            </p>
          )}
          {capped && (
            <p role="alert" className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
              You have reached this month&apos;s AI budget, so we could not generate suggestions.
              You can still add your own questions below.
            </p>
          )}

          <p className="mt-4 text-sm text-gray-600">
            These do <strong>not</strong> mention {brand || "your brand"} on purpose — we are
            measuring whether the assistant brings you up by itself. Keep {promptLimit} on{" "}
            {planName}.
          </p>

          <ul className="mt-4 space-y-2">
            {prompts.map((prompt, index) => (
              <li key={`${prompt.text}-${index}`} className="rounded-xl border border-gray-200 p-3">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 accent-blue-600"
                    checked={prompt.keep}
                    aria-label={`Track: ${prompt.text}`}
                    onChange={(e) =>
                      setPrompts((current) =>
                        current.map((p, i) => (i === index ? { ...p, keep: e.target.checked } : p)),
                      )
                    }
                  />
                  <div className="flex-1">
                    <textarea
                      className="w-full resize-none border-0 p-0 text-sm text-gray-900 focus:ring-0"
                      rows={2}
                      value={prompt.text}
                      onChange={(e) =>
                        setPrompts((current) =>
                          current.map((p, i) =>
                            // Editing makes it the user's question, not ours, so
                            // it stops carrying the score that ranked it.
                            i === index ? { ...p, text: e.target.value, custom: true } : p,
                          ),
                        )
                      }
                    />
                    {prompt.label && (
                      <span className="text-xs text-gray-500">{prompt.label}</span>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-4 flex gap-2">
            <input
              className={inputClass}
              value={customDraft}
              placeholder="Add a question your buyers ask…"
              onChange={(e) => setCustomDraft(e.target.value)}
            />
            <button
              type="button"
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700"
              disabled={customDraft.trim().length === 0}
              onClick={() => {
                setPrompts((current) => [
                  ...current,
                  {
                    text: customDraft.trim(),
                    category: "",
                    intent: "",
                    audience: null,
                    label: null,
                    score: 0,
                    keep: true,
                    custom: true,
                  },
                ]);
                setCustomDraft("");
              }}
            >
              Add
            </button>
          </div>

          <Nav
            onBack={() => setStep(1)}
            onNext={() => setStep(3)}
            nextDisabled={kept.length === 0}
            nextLabel={`Review ${kept.length} question${kept.length === 1 ? "" : "s"}`}
          />
        </section>
      )}

      {step === 3 && (
        <section className="mt-6 space-y-4">
          <dl className="rounded-xl border border-gray-200 p-4 text-sm">
            <Row label="Brand" value={brand} />
            <Row label="Website" value={website} />
            <Row
              label="Engines"
              value={selected
                .map((p) => engines.find((e) => e.provider === p)?.label ?? p)
                .join(", ")}
            />
            <Row label="Questions" value={String(kept.length)} />
          </dl>
          <p className="text-sm text-gray-600">
            We will run the first checkup shortly, then keep it on your plan&apos;s schedule.
          </p>
          <Nav
            onBack={() => setStep(2)}
            onNext={finish}
            nextDisabled={busy}
            nextLabel={busy ? "Setting up…" : "Start tracking"}
          />
        </section>
      )}
    </div>
  );
}

const inputClass =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-gray-900">{label}</span>
      {hint && <span className="mt-0.5 block text-xs text-gray-500">{hint}</span>}
      <span className="mt-1 block">{children}</span>
    </label>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-gray-100 py-2 last:border-0">
      <dt className="text-gray-500">{label}</dt>
      <dd className="text-gray-900">{value}</dd>
    </div>
  );
}

function Nav({
  onBack,
  onNext,
  nextDisabled,
  nextLabel,
}: {
  onBack?: () => void;
  onNext: () => void;
  nextDisabled?: boolean;
  nextLabel: string;
}) {
  return (
    <div className="mt-6 flex justify-between">
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700"
        >
          Back
        </button>
      ) : (
        <span />
      )}
      <button
        type="button"
        onClick={onNext}
        disabled={nextDisabled}
        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {nextLabel}
      </button>
    </div>
  );
}
