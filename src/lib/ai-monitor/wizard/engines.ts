// src/lib/ai-monitor/wizard/engines.ts
//
// Which engines the wizard offers, and which it shows greyed out.
//
// THE SAME PREDICATE THE RUNNER USES. Selectability is runner/providers.ts's
// refusalFor(), not a second list maintained here. That is the whole point: an
// engine a user can tick and the runner would then refuse is a checkup that
// reports zeros for a provider nobody ever called, which reads as "you are
// invisible on Gemini" when the truth is "we never asked Gemini". One predicate
// means the form cannot promise what the runner will not do.
//
// UNSELECTABLE ENGINES ARE STILL SHOWN. Hiding them would make the product look
// like it supports one engine; showing them disabled, with the reason, says
// what is coming and why it is not here yet. The reason matters — "no API key
// configured" is an operator's problem and "no adapter yet" is ours, and a
// support conversation goes differently depending on which.

import { ENGINE_CATALOGUE, type EngineSpec } from "../engines";
import { refusalFor, type RefusalReason } from "../runner/providers";

export interface WizardEngineOption {
  provider: string;
  label: string;
  selectable: boolean;
  supportsSearch: boolean;
  supportsCitations: boolean;
  /** Null when selectable. */
  reason: RefusalReason | null;
  /** Short, user-facing. Null when selectable. */
  note: string | null;
}

/**
 * User-facing wording for each refusal.
 *
 * Deliberately vague about OUR configuration and specific about the calendar.
 * A customer does not need to know which environment variable is unset; they
 * need to know whether ticking it next month will work.
 */
const NOTES: Record<RefusalReason, string> = {
  no_adapter: "Coming soon",
  no_rates: "Coming soon",
  missing_key: "Coming soon",
  missing_config: "Coming soon",
  unknown_engine: "Unavailable",
};

/** Every engine, in dashboard order, with its selectability resolved. */
export function wizardEngineOptions(
  env: NodeJS.ProcessEnv = process.env,
  catalogue: readonly EngineSpec[] = ENGINE_CATALOGUE,
): WizardEngineOption[] {
  return catalogue.map((engine) => {
    const refusal = refusalFor(engine, env);
    return {
      provider: engine.provider,
      label: engine.displayName,
      selectable: refusal === null,
      supportsSearch: engine.supportsSearch,
      supportsCitations: engine.supportsCitations,
      reason: refusal?.reason ?? null,
      note: refusal ? NOTES[refusal.reason] : null,
    };
  });
}

/** The provider ids a submission may legally contain. */
export function selectableProviders(
  env: NodeJS.ProcessEnv = process.env,
  catalogue: readonly EngineSpec[] = ENGINE_CATALOGUE,
): string[] {
  return wizardEngineOptions(env, catalogue)
    .filter((option) => option.selectable)
    .map((option) => option.provider);
}

/**
 * Drop anything the user should not have been able to tick.
 *
 * The form disables them, so reaching here means either a stale page or a
 * hand-made request. Filtering rather than rejecting keeps a stale tab working:
 * the user loses the engine they could never have had, not the whole
 * submission they spent five minutes on.
 */
export function keepSelectableEngines(
  requested: readonly string[],
  env: NodeJS.ProcessEnv = process.env,
  catalogue: readonly EngineSpec[] = ENGINE_CATALOGUE,
): string[] {
  const allowed = new Set(selectableProviders(env, catalogue));
  return [...new Set(requested)].filter((provider) => allowed.has(provider));
}
