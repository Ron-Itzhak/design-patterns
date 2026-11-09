/**
 * ATTEMPT INDEXING (read this first): attempts are numbered from 1.
 * Both methods receive `attempt` = the number of the attempt that JUST FAILED.
 *   attempt 1 failed -> shouldRetry(err, 1)? -> nextDelayMs(1) = wait before attempt 2
 *   attempt 2 failed -> shouldRetry(err, 2)? -> nextDelayMs(2) = wait before attempt 3
 */
export interface RetryStrategy {
  shouldRetry(error: unknown, attempt: number): boolean;
  nextDelayMs(attempt: number): number;
}

/** What an outbound HTTP client throws. `status` is missing for network errors / timeouts. */
export class HttpError extends Error {
  constructor(
    readonly status: number | undefined,
    message = `HTTP ${status}`,
    readonly retryAfterMs?: number, // from a Retry-After header, already converted to ms
  ) {
    super(message);
    this.name = "HttpError";
  }
}

/** Is this kind of failure worth retrying at all? (Separate from "how many times".) */
export function isRetryableError(error: unknown): boolean {
  if (!(error instanceof HttpError)) return true; // unknown / network failure: assume transient
  const { status } = error;
  if (status === undefined) return true; // timeout, connection reset
  return status === 429 || status >= 500; // rate limited or server trouble; other 4xx are our fault
}
