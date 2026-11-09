import { measure } from "./memory.js";
import { KNOWN_PORT_CODES, loadPortMetadata, PortMetadataFactory, type PortMetadata } from "./portMetadata.js";
import type { ShippingRate } from "./shippingRate.js";

const COUNT = 1_000_000;

function buildRates(getPort: (code: string) => PortMetadata): ShippingRate[] {
  const rates: ShippingRate[] = [];
  for (let i = 0; i < COUNT; i++) {
    rates.push({
      shipmentId: `SHP-${i}`,
      priceMinor: 10_000 + (i % 5000),
      quotedAt: 1_700_000_000_000 + i,
      port: getPort(KNOWN_PORT_CODES[i % KNOWN_PORT_CODES.length]!),
    });
  }
  return rates;
}

// Without flyweight: every rate loads its own copy of the metadata
const naive = measure(() => buildRates(loadPortMetadata));

// With flyweight: repeated codes return the same shared object
const factory = new PortMetadataFactory();
const shared = measure(() => buildRates((code) => factory.get(code)));

console.log(`${COUNT.toLocaleString()} rates, ${KNOWN_PORT_CODES.length} distinct ports`);
console.log(`Naive      : ${COUNT.toLocaleString()} metadata objects, +${naive.deltaMb.toFixed(1)} MB heap`);
const s = factory.stats();
console.log(`Flyweight  : ${s.created} metadata objects (${s.requests.toLocaleString()} requests), +${shared.deltaMb.toFixed(1)} MB heap`);
console.log("(illustrative: results vary by machine and Node version)");
