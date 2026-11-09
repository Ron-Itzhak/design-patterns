import { executeWithRetry } from "./executeWithRetry.js";
import { HttpError, type RetryStrategy } from "./retryStrategy.js";
import { ExponentialBackoffRetry, FixedDelayRetry, NoRetry } from "./strategies.js";

/** A fake provider: fails with `error` for the first `failures` calls, then succeeds. */
const flaky = (failures: number, error: Error) => {
  let calls = 0;
  return async (attempt: number) => {
    calls++;
    if (calls <= failures) throw error;
    return `ok on attempt ${attempt}`;
  };
};

async function run(label: string, strategy: RetryStrategy, fn: (attempt: number) => Promise<string>) {
  const delays: number[] = [];
  const fakeSleep = async (ms: number) => void delays.push(ms); // records instead of waiting
  try {
    console.log(`${label}\n  result: ${await executeWithRetry(fn, strategy, fakeSleep)}\n  waited: [${delays}]`);
  } catch (e) {
    console.log(`${label}\n  gave up: ${(e as Error).message}\n  waited: [${delays}]`);
  }
}

const serverError = new HttpError(503);
await run("NoRetry, provider fails once", new NoRetry(), flaky(1, serverError));
await run("FixedDelay(200ms, 4 attempts), fails 3x", new FixedDelayRetry(200, 4), flaky(3, serverError));
await run("Exponential(100ms, cap 500, 5 attempts), fails 4x", new ExponentialBackoffRetry({ baseMs: 100, capMs: 500, maxAttempts: 5 }), flaky(4, serverError));
await run("Exponential, always failing (hits max attempts)", new ExponentialBackoffRetry({ baseMs: 100, capMs: 500, maxAttempts: 3 }), flaky(99, serverError));
await run("404 is not retryable", new FixedDelayRetry(200, 4), flaky(1, new HttpError(404)));
await run("429 with Retry-After: 5000ms", new FixedDelayRetry(200, 3), flaky(1, new HttpError(429, "rate limited", 5000)));
