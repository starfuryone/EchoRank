import type { MonitoringSource } from "@/generated/prisma";

export interface NormalizedReview {
  externalId: string;
  authorName?: string;
  authorUrl?: string;
  rating?: number;
  content?: string;
  language?: string;
  publishedAt?: Date;
  url?: string;
  metadata?: Record<string, unknown>;
}

export interface FetchResult {
  reviews: NormalizedReview[];
  hasMore: boolean;
  cursor?: string;
}

export abstract class PlatformAdapter {
  protected readonly maxRetries = 3;
  protected readonly timeoutMs = 30_000;
  protected readonly retryDelayMs = 1_000;

  abstract get platformName(): string;

  /**
   * Fetch reviews from the platform source since the given date.
   */
  abstract fetchReviews(
    source: MonitoringSource,
    since?: Date
  ): Promise<NormalizedReview[]>;

  /**
   * Validate that the provided credentials are sufficient for this platform.
   */
  abstract validateCredentials(
    credentials: Record<string, unknown>
  ): { valid: boolean; errors: string[] };

  /**
   * HTTP client wrapper with retry logic and timeout.
   * In a real implementation this would make actual HTTP requests.
   */
  protected async fetchWithRetry(
    url: string,
    options: {
      method?: string;
      headers?: Record<string, string>;
      body?: string;
      timeout?: number;
    } = {}
  ): Promise<{ status: number; data: unknown }> {
    const timeout = options.timeout ?? this.timeoutMs;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeout);

        try {
          const response = await fetch(url, {
            method: options.method ?? "GET",
            headers: options.headers,
            body: options.body,
            signal: controller.signal,
          });

          const data = await response.json();
          return { status: response.status, data };
        } finally {
          clearTimeout(timer);
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < this.maxRetries - 1) {
          await this.delay(this.retryDelayMs * Math.pow(2, attempt));
        }
      }
    }

    throw lastError ?? new Error("Request failed after retries");
  }

  protected delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Generate a deterministic random number from a seed string.
   * Used by mock adapters for reproducible data generation.
   */
  protected seededRandom(seed: string): number {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      const char = seed.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    return Math.abs(hash % 1000) / 1000;
  }
}
