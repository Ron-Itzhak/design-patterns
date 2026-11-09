/** The stable internal contract. Application code depends ONLY on this file. */

export interface ShippingRequest {
  readonly fromZip: string;
  readonly toZip: string;
  readonly weightKg: number;
}

/** Money is always an integer in minor units (cents), never a float. */
export interface RateQuote {
  readonly amountMinor: number;
  readonly currency: string; // ISO 4217, upper case
}

export interface ShippingRateProvider {
  getQuote(request: ShippingRequest): Promise<RateQuote>;
}

export type ShippingErrorCode = "INVALID_CURRENCY" | "MALFORMED_RESPONSE" | "TIMEOUT" | "PROVIDER_ERROR";

/** The only error type the application ever sees, whatever the provider did. */
export class ShippingProviderError extends Error {
  constructor(
    readonly code: ShippingErrorCode,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "ShippingProviderError";
  }
}
