import { describe, expect, it, vi } from "vitest";
import { executeWithRetry } from "./executeWithRetry.js";
import { HttpError } from "./retryStrategy.js";
import { ExponentialBackoffRetry, FixedDelayRetry, NoRetry } from "./strategies.js";

/** Records delays instead of waiting. */
function fakeSleep() {
  const delays: number[] = [];
  return { delays, sleep: async (ms: number) => void delays.push(ms) };
}

const alwaysFail = (error: Error) => vi.fn(async (_attempt: number): Promise<string> => { throw error; });

describe("NoRetry", () => {
  it("calls once and throws", async () => {
    const fn = alwaysFail(new HttpError(503));
    const { sleep, delays } = fakeSleep();
    await expect(executeWithRetry(fn, new NoRetry(), sleep)).rejects.toThrow("HTTP 503");
    expect(fn).toHaveBeenCalledTimes(1);
    expect(delays).toEqual([]);
  });
});

describe("FixedDelayRetry", () => {
  it("waits the same delay between attempts, stops at maxAttempts, throws the last error", async () => {
    const fn = alwaysFail(new HttpError(503));
    const { sleep, delays } = fakeSleep();
    await expect(executeWithRetry(fn, new FixedDelayRetry(100, 4), sleep)).rejects.toThrow("HTTP 503");
    expect(fn).toHaveBeenCalledTimes(4);
    expect(delays).toEqual([100, 100, 100]); // 4 attempts = 3 waits
  });

  it("returns the value and passes the 1-based attempt number to fn", async () => {
    const fn = vi.fn(async (attempt: number) => {
      if (attempt < 3) throw new HttpError(500);
      return `done-${attempt}`;
    });
    const { sleep } = fakeSleep();
    expect(await executeWithRetry(fn, new FixedDelayRetry(10, 5), sleep)).toBe("done-3");
    expect(fn.mock.calls.map(([a]) => a)).toEqual([1, 2, 3]);
  });
});

describe("ExponentialBackoffRetry", () => {
  it("doubles the delay and respects the cap", async () => {
    const { sleep, delays } = fakeSleep();
    const strategy = new ExponentialBackoffRetry({ baseMs: 100, capMs: 350, maxAttempts: 6 });
    await expect(executeWithRetry(alwaysFail(new HttpError(500)), strategy, sleep)).rejects.toThrow();
    expect(delays).toEqual([100, 200, 350, 350, 350]);
  });

  it("applies jitter using the injected random (full jitter: 0..computed)", async () => {
    const { sleep, delays } = fakeSleep();
    const strategy = new ExponentialBackoffRetry({ baseMs: 100, capMs: 1000, maxAttempts: 4, jitter: true, random: () => 0.5 });
    await expect(executeWithRetry(alwaysFail(new HttpError(500)), strategy, sleep)).rejects.toThrow();
    expect(delays).toEqual([50, 100, 200]); // half of 100, 200, 400
  });

  it("jitter never exceeds the computed delay", () => {
    const s = new ExponentialBackoffRetry({ baseMs: 100, capMs: 1000, maxAttempts: 9, jitter: true, random: () => 0.999 });
    expect(s.nextDelayMs(1)).toBeLessThan(100);
  });
});

describe("error handling", () => {
  it("does not retry non-retryable errors (400, 404)", async () => {
    for (const status of [400, 404]) {
      const fn = alwaysFail(new HttpError(status));
      const { sleep, delays } = fakeSleep();
      await expect(executeWithRetry(fn, new FixedDelayRetry(100, 5), sleep)).rejects.toThrow();
      expect(fn).toHaveBeenCalledTimes(1);
      expect(delays).toEqual([]);
    }
  });

  it("retries 429 and 5xx and network errors", async () => {
    for (const error of [new HttpError(429), new HttpError(502), new HttpError(undefined, "timeout"), new TypeError("fetch failed")]) {
      const fn = alwaysFail(error);
      await expect(executeWithRetry(fn, new FixedDelayRetry(1, 3), fakeSleep().sleep)).rejects.toThrow();
      expect(fn).toHaveBeenCalledTimes(3);
    }
  });

  it("429 with Retry-After waits at least as long as the server asked", async () => {
    const fn = vi.fn(async (attempt: number) => {
      if (attempt === 1) throw new HttpError(429, "slow down", 5000);
      return "ok";
    });
    const { sleep, delays } = fakeSleep();
    await executeWithRetry(fn, new FixedDelayRetry(100, 3), sleep);
    expect(delays).toEqual([5000]); // not the strategy's 100
  });

  it("Retry-After shorter than the strategy delay does not shorten the wait", async () => {
    const fn = vi.fn(async (attempt: number) => {
      if (attempt === 1) throw new HttpError(429, "slow down", 10);
      return "ok";
    });
    const { sleep, delays } = fakeSleep();
    await executeWithRetry(fn, new FixedDelayRetry(100, 3), sleep);
    expect(delays).toEqual([100]);
  });
});
