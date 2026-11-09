import { HttpError, type RetryStrategy } from "./retryStrategy.js";

export type Sleep = (ms: number) => Promise<void>;

export const realSleep: Sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Calls `fn` until it succeeds or the strategy says stop. `fn` receives the attempt number (1-based).
 * `sleep` is injected so tests can run instantly and record the exact delays.
 * When retries run out (or the error is not retryable), the LAST error is thrown.
 */
export async function executeWithRetry<T>(
  fn: (attempt: number) => Promise<T>,
  strategy: RetryStrategy,
  sleep: Sleep = realSleep,
): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn(attempt);
    } catch (error) {
      if (!strategy.shouldRetry(error, attempt)) throw error;
      // 429: if the server said "come back in N ms", never wait less than that
      const serverHint = error instanceof HttpError ? (error.retryAfterMs ?? 0) : 0;
      await sleep(Math.max(strategy.nextDelayMs(attempt), serverHint));
    }
  }
}
