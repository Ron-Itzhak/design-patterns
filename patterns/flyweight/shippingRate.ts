import type { PortMetadata } from "./portMetadata.js";

/** EXTRINSIC state (unique per record) lives here, never in the shared metadata. */
export interface ShippingRate {
  shipmentId: string;
  priceMinor: number;
  quotedAt: number;
  port: PortMetadata; // just a pointer to the shared flyweight
}
