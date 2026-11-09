import type { RateQuote, ShippingRateProvider, ShippingRequest } from "./shippingRateProvider.js";

/** Application code: knows nothing about Provider A or B, only the interface. */
export async function cheapestQuote(providers: ShippingRateProvider[], request: ShippingRequest): Promise<RateQuote> {
  const quotes = await Promise.all(providers.map((p) => p.getQuote(request)));
  return quotes.reduce((best, q) => (q.amountMinor < best.amountMinor ? q : best));
}
