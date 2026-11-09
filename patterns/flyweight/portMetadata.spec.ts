import { describe, expect, it } from "vitest";
import { PortMetadataFactory } from "./portMetadata.js";
import type { ShippingRate } from "./shippingRate.js";

describe("PortMetadataFactory", () => {
  it("returns the same object for the same code, including different spellings", () => {
    const f = new PortMetadataFactory();
    const a = f.get("NLRTM");
    expect(f.get("NLRTM")).toBe(a);
    expect(f.get("  nlrtm ")).toBe(a);
  });

  it("returns separate objects for different ports", () => {
    const f = new PortMetadataFactory();
    const rotterdam = f.get("NLRTM");
    const shanghai = f.get("CNSHA");
    expect(shanghai).not.toBe(rotterdam);
    expect(shanghai).toMatchObject({ code: "CNSHA", country: "China" });
  });

  it("is not changed by attempted mutation", () => {
    const f = new PortMetadataFactory();
    const port = f.get("SGSIN");
    expect(() => ((port as any).country = "Hacked")).toThrow(TypeError); // ESM = strict mode
    expect(() => delete (port as any).timezone).toThrow(TypeError);
    expect(() => ((port as any).customerId = "c-1")).toThrow(TypeError);
    expect(f.get("SGSIN")).toEqual({ code: "SGSIN", country: "Singapore", timezone: "Asia/Singapore" });
    expect(Object.isFrozen(port)).toBe(true);
  });

  it("holds only intrinsic fields (no customer or rate data)", () => {
    expect(Object.keys(new PortMetadataFactory().get("DEHAM")).sort()).toEqual(["code", "country", "timezone"]);
  });

  it("rejects invalid and unknown codes", () => {
    const f = new PortMetadataFactory();
    expect(() => f.get("")).toThrow(/Invalid/);
    expect(() => f.get("NL")).toThrow(/Invalid/);
    expect(() => f.get("ZZZZZ")).toThrow(/Unknown/);
  });

  it("counts requests vs objects actually created", () => {
    const f = new PortMetadataFactory();
    for (let i = 0; i < 100; i++) f.get(i % 2 ? "NLRTM" : "CNSHA");
    expect(f.stats()).toEqual({ requests: 100, created: 2 });
  });
});

describe("rates sharing a flyweight", () => {
  it("many rates point at one port, while their own fields stay independent", () => {
    const f = new PortMetadataFactory();
    const rates: ShippingRate[] = Array.from({ length: 1000 }, (_, i) => ({
      shipmentId: `S${i}`,
      priceMinor: 100,
      quotedAt: i,
      port: f.get("USLAX"),
    }));
    rates[0]!.priceMinor = 999; // rate fields are mutable and private to each record
    expect(rates[1]!.priceMinor).toBe(100);
    expect(new Set(rates.map((r) => r.port)).size).toBe(1);
    expect(f.stats().created).toBe(1);
  });
});
