import { ReportRequestBuilder } from "./reportRequest.js";

// Report 1: sales as compressed CSV, sorted, with two filters
const sales = new ReportRequestBuilder()
  .withDateRange(new Date("2025-01-01"), new Date("2025-03-31"))
  .addFilter("region", "EU")
  .addFilter("status", "paid")
  .withFormat("csv")
  .sortBy("amount", "desc")
  .enableCompression()
  .build();
console.log("Sales report:", sales);

// Report 2: same API, different shape (no filters, no sort, no compression)
const audit = new ReportRequestBuilder()
  .withDateRange(new Date("2025-06-01"), new Date("2025-06-30"))
  .withFormat("pdf")
  .build();
console.log("Audit report:", audit);

// Validation failures are thrown at build() time
try {
  new ReportRequestBuilder()
    .withDateRange(new Date("2025-02-01"), new Date("2025-01-01"))
    .withFormat("csv")
    .build();
} catch (e) {
  console.log("Inverted range rejected:", (e as Error).message);
}

try {
  new ReportRequestBuilder()
    .withDateRange(new Date("2025-01-01"), new Date("2025-01-31"))
    .withFormat("pdf")
    .enableCompression()
    .build();
} catch (e) {
  console.log("pdf + compression rejected:", (e as Error).message);
}
