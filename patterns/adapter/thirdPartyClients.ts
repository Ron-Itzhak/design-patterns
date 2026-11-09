/**
 * Simulated third-party clients. We do NOT own or change these; their shapes
 * are the "incompatible interfaces" the adapters translate.
 */
import type { ShippingRequest } from "./shippingRateProvider.js";

export interface ProviderAClient {
  /** Resolves to e.g. { price: 120, currency: "USD" } (major units). */
  fetchRate(req: ShippingRequest): Promise<unknown>;
}

export interface ProviderBClient {
  /** Resolves to e.g. { total_amount: 12000, currency_code: "USD", minor_units: true }. */
  getShippingCost(from: string, to: string, kg: number): Promise<unknown>;
}

export const fakeProviderA: ProviderAClient = {
  fetchRate: async () => ({ price: 120, currency: "USD" }),
};

export const fakeProviderB: ProviderBClient = {
  getShippingCost: async () => ({ total_amount: 12000, currency_code: "USD", minor_units: true }),
};
