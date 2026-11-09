import { describe, expect, it } from "vitest";
import { ProviderAAdapter, ProviderBAdapter } from "./adapters.js";
import { cheapestQuote } from "./cheapestQuote.js";
import { ShippingProviderError, type ShippingRateProvider } from "./shippingRateProvider.js";

const req = { fromZip: "10001", toZip: "94105", weightKg: 2 };
const a = (payload: unknown, ms?: number) => new ProviderAAdapter({ fetchRate: async () => payload }, ms);
const b = (payload: unknown, ms?: number) => new ProviderBAdapter({ getShippingCost: async () => payload }, ms);

describe("normalisation", () => {
  it("both providers produce the same RateQuote", async () => {
    const qa = await a({ price: 120, currency: "USD" }).getQuote(req);
    const qb = await b({ total_amount: 12000, currency_code: "USD", minor_units: true }).getQuote(req);
    expect(qa).toEqual({ amountMinor: 12000, currency: "USD" });
    expect(qb).toEqual(qa);
  });

  it("avoids float errors (19.99 -> 1999, not 1998.99...)", async () => {
    expect((await a({ price: 19.99, currency: "USD" }).getQuote(req)).amountMinor).toBe(1999);
    expect((await a({ price: 1.1, currency: "USD" }).getQuote(req)).amountMinor).toBe(110);
  });

  it("respects currency exponent (JPY has no minor unit)", async () => {
    expect((await a({ price: 500, currency: "JPY" }).getQuote(req)).amountMinor).toBe(500);
  });

  it("B with minor_units:false is treated as major units", async () => {
    const q = await b({ total_amount: 12.5, currency_code: "EUR", minor_units: false }).getQuote(req);
    expect(q).toEqual({ amountMinor: 1250, currency: "EUR" });
  });
});

describe("errors are translated to ShippingProviderError", () => {
  const code = (p: Promise<unknown>) => p.catch((e: ShippingProviderError) => e.code);

  it("invalid currency", async () => {
    expect(await code(a({ price: 1, currency: "XXX" }).getQuote(req))).toBe("INVALID_CURRENCY");
    expect(await code(b({ total_amount: 100, currency_code: 5, minor_units: true }).getQuote(req))).toBe("INVALID_CURRENCY");
  });

  it("timeout", async () => {
    const slowA = new ProviderAAdapter({ fetchRate: () => new Promise(() => {}) }, 10);
    const slowB = new ProviderBAdapter({ getShippingCost: () => new Promise(() => {}) }, 10);
    expect(await code(slowA.getQuote(req))).toBe("TIMEOUT");
    expect(await code(slowB.getQuote(req))).toBe("TIMEOUT");
  });

  it("malformed payloads", async () => {
    for (const bad of [null, "oops", {}, { price: "120", currency: "USD" }, { price: -1, currency: "USD" }, { price: 1.234, currency: "USD" }]) {
      expect(await code(a(bad).getQuote(req))).toMatch(/MALFORMED_RESPONSE|INVALID_CURRENCY/);
    }
    expect(await code(b({ total_amount: 120.5, currency_code: "USD", minor_units: true }).getQuote(req))).toBe("MALFORMED_RESPONSE");
    expect(await code(b({ total_amount: "12000", currency_code: "USD", minor_units: true }).getQuote(req))).toBe("MALFORMED_RESPONSE");
  });

  it("provider exceptions are wrapped, original kept as cause", async () => {
    const boom = new Error("503 from provider");
    const adapter = new ProviderAAdapter({ fetchRate: async () => { throw boom; } });
    const err = await adapter.getQuote(req).catch((e) => e);
    expect(err).toBeInstanceOf(ShippingProviderError);
    expect(err.code).toBe("PROVIDER_ERROR");
    expect(err.cause).toBe(boom);
  });
});

describe("application code depends only on the interface", () => {
  it("cheapestQuote works with any ShippingRateProvider", async () => {
    const stub: ShippingRateProvider = { getQuote: async () => ({ amountMinor: 999, currency: "USD" }) };
    const q = await cheapestQuote([a({ price: 120, currency: "USD" }), stub], req);
    expect(q.amountMinor).toBe(999);
  });
});
