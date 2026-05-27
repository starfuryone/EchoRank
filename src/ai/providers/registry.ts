// ---------------------------------------------------------------------------
// AI Provider Registry – selects the active provider based on configuration
// ---------------------------------------------------------------------------

import { type AiProvider } from "./base";
import { MockProvider } from "./mock";
import { OpenAiProvider } from "./openai";
import { AnthropicProvider } from "./anthropic";

let _cachedProvider: AiProvider | null = null;

/**
 * Returns the active AI provider based on environment configuration.
 *
 * Priority:
 *  1. If OPENAI_API_KEY is set, use OpenAI
 *  2. If ANTHROPIC_API_KEY is set, use Anthropic
 *  3. Otherwise, use the Mock provider
 *
 * The provider instance is cached for the lifetime of the process.
 */
export function getProvider(): AiProvider {
  if (_cachedProvider) return _cachedProvider;

  if (process.env.OPENAI_API_KEY) {
    try {
      _cachedProvider = new OpenAiProvider();
      console.log("[AI Registry] Using OpenAI provider");
      return _cachedProvider;
    } catch (err) {
      console.warn("[AI Registry] Failed to initialize OpenAI provider:", err);
    }
  }

  if (process.env.ANTHROPIC_API_KEY) {
    try {
      _cachedProvider = new AnthropicProvider();
      console.log("[AI Registry] Using Anthropic provider");
      return _cachedProvider;
    } catch (err) {
      console.warn(
        "[AI Registry] Failed to initialize Anthropic provider:",
        err,
      );
    }
  }

  _cachedProvider = new MockProvider();
  console.log("[AI Registry] Using Mock provider (no API keys configured)");
  return _cachedProvider;
}

/**
 * Returns true if the active provider performs real AI inference (not mock).
 */
export function isRealInference(): boolean {
  return !getProvider().isMock;
}

/**
 * Reset the cached provider (useful for testing).
 */
export function resetProvider(): void {
  _cachedProvider = null;
}
