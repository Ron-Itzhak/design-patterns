import { describe, expect, it } from "vitest";
import { ReportRequestBuilder } from "./reportRequest.js";

const jan = () => new ReportRequestBuilder().withDateRange(new Date("2025-01-01"), new Date("2025-01-31"));

describe("ReportRequestBuilder", () => {
  it("chains every method and builds two distinct reports", () => {
    const sales = jan().addFilter("region", "EU").withFormat("csv").sortBy("amount", "desc").enableCompression().build();
    const audit = new ReportRequestBuilder()
      .withDateRange(new Date("2025-06-01"), new Date("2025-06-30"))
      .withFormat("pdf")
      .build();

    expect(sales).toMatchObject({ format: "csv", compressed: true, sort: { field: "amount", direction: "desc" } });
    expect(sales.filters).toEqual([{ field: "region", value: "EU" }]);
    expect(audit).toMatchObject({ format: "pdf", compressed: false, filters: [] });
    expect(audit.sort).toBeUndefined();
  });

  describe("validation", () => {
    it("rejects an inverted date range", () => {
      const b = new ReportRequestBuilder().withDateRange(new Date("2025-02-01"), new Date("2025-01-01")).withFormat("csv");
      expect(() => b.build()).toThrow(/inverted/);
    });

    it("rejects pdf + compression", () => {
      expect(() => jan().withFormat("pdf").enableCompression().build()).toThrow(/pdf/);
    });

    it("requires a date range and a format", () => {
      expect(() => new ReportRequestBuilder().withFormat("csv").build()).toThrow(/Date range/);
      expect(() => jan().build()).toThrow(/Format/);
    });
  });

  describe("immutability", () => {
    it("freezes the result, its filters array and each filter", () => {
      const r = jan().addFilter("a", "1").withFormat("json").sortBy("a").build();
      expect(Object.isFrozen(r)).toBe(true);
      expect(Object.isFrozen(r.filters)).toBe(true);
      expect(Object.isFrozen(r.filters[0])).toBe(true);
      expect(Object.isFrozen(r.sort)).toBe(true);
      expect(() => (r as any).format = "csv").toThrow(TypeError); // ESM = strict mode
      expect(() => (r.filters as any).push({})).toThrow(TypeError);
    });

    it("later builder changes do not affect an already built report", () => {
      const builder = jan().addFilter("a", "1").withFormat("csv");
      const first = builder.build();
      builder.addFilter("b", "2").withFormat("json");
      expect(first.filters).toHaveLength(1);
      expect(first.format).toBe("csv");
    });

    it("two builds from one builder do not share arrays or filter objects", () => {
      const builder = jan().addFilter("a", "1").withFormat("csv");
      const one = builder.build();
      const two = builder.build();
      expect(one).not.toBe(two);
      expect(one.filters).not.toBe(two.filters);
      expect(one.filters[0]).not.toBe(two.filters[0]);
    });

    it("mutating the original Date passed in does not change the builder", () => {
      const from = new Date("2025-01-01");
      const builder = new ReportRequestBuilder().withDateRange(from, new Date("2025-01-31")).withFormat("csv");
      from.setFullYear(2030);
      expect(builder.build().from.getFullYear()).toBe(2025);
    });
  });
});
