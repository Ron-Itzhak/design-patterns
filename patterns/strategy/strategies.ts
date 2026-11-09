import { isRetryableError, type RetryStrategy } from "./retryStrategy.js";

/** Never retry. The first failure is final. */
export class NoRetry implements RetryStrategy {
  shouldRetry(): boolean {
    return false;
  }
  nextDelayMs(): number {
    return 0;
  }
}

/** Same wait every time, up to maxAttempts total attempts. */
export class FixedDelayRetry implements RetryStrategy {
  constructor(
    private readonly delayMs: number,
    private readonly maxAttempts: number,
  ) {}

  shouldRetry(error: unknown, attempt: number): boolean {
    return attempt < this.maxAttempts && isRetryableError(error);
  }

  nextDelayMs(): number {
    return this.delayMs;
  }
}

export interface ExponentialOptions {
  baseMs: number; // delay after the 1st failure
  capMs: number; // delay never exceeds this
  maxAttempts: number;
  jitter?: boolean; // "full jitter": pick a random delay between 0 and the computed one
  random?: () => number; // injected so tests are deterministic
}

/** base, base*2, base*4, ... capped. Optional jitter spreads out clients that failed together. */
export class ExponentialBackoffRetry implements RetryStrategy {
  private readonly random: () => number;

  constructor(private readonly opts: ExponentialOptions) {
    this.random = opts.random ?? Math.random;
  }

  shouldRetry(error: unknown, attempt: number): boolean {
    return attempt < this.opts.maxAttempts && isRetryableError(error);
  }

  nextDelayMs(attempt: number): number {
    const exponential = Math.min(this.opts.capMs, this.opts.baseMs * 2 ** (attempt - 1));
    return this.opts.jitter ? Math.floor(this.random() * exponential) : exponential;
  }
}
