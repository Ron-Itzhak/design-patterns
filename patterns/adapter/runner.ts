import { ProviderAAdapter, ProviderBAdapter } from "./adapters.js";
import { cheapestQuote } from "./cheapestQuote.js";
import { fakeProviderA, fakeProviderB } from "./thirdPartyClients.js";

const request = { fromZip: "10001", toZip: "94105", weightKg: 2 };

const a = new ProviderAAdapter(fakeProviderA);
const b = new ProviderBAdapter(fakeProviderB);

console.log("A ->", await a.getQuote(request));
console.log("B ->", await b.getQuote(request));
console.log("Cheapest ->", await cheapestQuote([a, b], request));

// A provider that returns garbage: the app sees our error type, not provider details
const broken = new ProviderBAdapter({ getShippingCost: async () => ({ total_amount: "12000", currency_code: "USD", minor_units: true }) });
try {
  await broken.getQuote(request);
} catch (e) {
  console.log("Broken provider ->", (e as Error).name, (e as Error & { code: string }).code);
}
