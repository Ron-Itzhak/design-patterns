import { ShippingProviderError } from "./shippingRateProvider.js";

/** How many decimal digits each supported currency has. Unknown = rejected. */
const EXPONENT: Readonly<Record<string, number>> = { USD: 2, EUR: 2, GBP: 2, JPY: 0 };

export function currencyExponent(currency: unknown): number {
  const exponent = typeof currency === "string" ? EXPONENT[currency] : undefined;
  if (exponent === undefined) {
    throw new ShippingProviderError("INVALID_CURRENCY", `Unsupported currency: ${String(currency)}`);
  }
  return exponent;
}

/** Major units (e.g. 19.99) -> integer minor units (1999). Rejects extra precision. */
export function majorToMinor(major: unknown, exponent: number): number {
  if (typeof major !== "number" || !Number.isFinite(major) || major < 0) {
    throw new ShippingProviderError("MALFORMED_RESPONSE", `Bad amount: ${String(major)}`);
  }
  const factor = 10 ** exponent;
  const minor = Math.round(major * factor); // round() removes float noise: 19.99*100 = 1998.9999999999998
  if (Math.abs(minor / factor - major) > 1e-9) {
    throw new ShippingProviderError("MALFORMED_RESPONSE", `Too many decimals for currency: ${major}`);
  }
  return minor;
}

export function assertMinorInteger(minor: unknown): number {
  if (typeof minor !== "number" || !Number.isSafeInteger(minor) || minor < 0) {
    throw new ShippingProviderError("MALFORMED_RESPONSE", `Bad minor-unit amount: ${String(minor)}`);
  }
  return minor;
}
