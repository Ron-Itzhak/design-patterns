import { assertMinorInteger, currencyExponent, majorToMinor } from "./money.js";
import {
  ShippingProviderError,
  type RateQuote,
  type ShippingRateProvider,
  type ShippingRequest,
} from "./shippingRateProvider.js";
import type { ProviderAClient, ProviderBClient } from "./thirdPartyClients.js";

/** Shared plumbing: timeout + turning any thrown error into our own error type. */
async function callProvider(call: () => Promise<unknown>, timeoutMs: number): Promise<unknown> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new ShippingProviderError("TIMEOUT", `No answer in ${timeoutMs}ms`)), timeoutMs);
  });
  try {
    return await Promise.race([call(), timeout]);
  } catch (err) {
    if (err instanceof ShippingProviderError) throw err;
    throw new ShippingProviderError("PROVIDER_ERROR", "Provider call failed", { cause: err });
  } finally {
    clearTimeout(timer);
  }
}

function asObject(payload: unknown): Record<string, unknown> {
  if (typeof payload !== "object" || payload === null) {
    throw new ShippingProviderError("MALFORMED_RESPONSE", "Response is not an object");
  }
  return payload as Record<string, unknown>;
}

/** Provider A: { price: 120, currency: "USD" }  (major units) */
export class ProviderAAdapter implements ShippingRateProvider {
  constructor(
    private readonly client: ProviderAClient,
    private readonly timeoutMs = 2000,
  ) {}

  async getQuote(request: ShippingRequest): Promise<RateQuote> {
    const raw = asObject(await callProvider(() => this.client.fetchRate(request), this.timeoutMs));
    const exponent = currencyExponent(raw.currency);
    return { amountMinor: majorToMinor(raw.price, exponent), currency: raw.currency as string };
  }
}

/** Provider B: { total_amount: 12000, currency_code: "USD", minor_units: true } */
export class ProviderBAdapter implements ShippingRateProvider {
  constructor(
    private readonly client: ProviderBClient,
    private readonly timeoutMs = 2000,
  ) {}

  async getQuote(request: ShippingRequest): Promise<RateQuote> {
    const raw = asObject(
      await callProvider(() => this.client.getShippingCost(request.fromZip, request.toZip, request.weightKg), this.timeoutMs),
    );
    const exponent = currencyExponent(raw.currency_code);
    const amountMinor =
      raw.minor_units === true ? assertMinorInteger(raw.total_amount) : majorToMinor(raw.total_amount, exponent);
    return { amountMinor, currency: raw.currency_code as string };
  }
}
