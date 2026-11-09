import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { Worker } from "node:worker_threads";
import { Test } from "@nestjs/testing";
import { Scope } from "@nestjs/common";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsProvider } from "./settingsProvider.js";
// @ts-expect-error plain JS fixture without type declarations
import { increment } from "./fixtures/counter.mjs";

const fixture = (name: string) => fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url));

describe("Pattern 1: class Singleton (SettingsProvider)", () => {
  beforeEach(() => SettingsProvider.resetForTests()); // isolation: every test starts clean

  it("returns the same reference across repeated calls", () => {
    const a = SettingsProvider.getInstance();
    expect(SettingsProvider.getInstance()).toBe(a);
    expect(SettingsProvider.getInstance({})).toBe(a);
  });

  it("keeps configuration stable and frozen", () => {
    const a = SettingsProvider.getInstance({ port: 8080 });
    expect(a.config.port).toBe(8080);
    expect(Object.isFrozen(a.config)).toBe(true);
    expect(SettingsProvider.getLoadCount()).toBe(1);
    SettingsProvider.getInstance();
    expect(SettingsProvider.getLoadCount()).toBe(1);
  });

  it("isolates tests: reset gives a fresh instance with fresh settings", () => {
    const first = SettingsProvider.getInstance({ port: 1111 });
    SettingsProvider.resetForTests();
    const second = SettingsProvider.getInstance({ port: 2222 });
    expect(second).not.toBe(first);
    expect(second.config.port).toBe(2222);
    expect(SettingsProvider.getLoadCount()).toBe(1);
  });

  it("NEGATIVE: rejects conflicting re-initialisation and keeps original config", () => {
    const a = SettingsProvider.getInstance({ port: 8080 });
    expect(() => SettingsProvider.getInstance({ port: 9999 })).toThrow(/already initialised/);
    expect(a.config.port).toBe(8080);
  });

  it("NEGATIVE: config cannot be mutated", () => {
    const a = SettingsProvider.getInstance();
    expect(() => {
      (a.config as { port: number }).port = 1;
    }).toThrow(TypeError);
  });

  it("FAILURE: invalid settings throw and leave no half-built instance behind", () => {
    expect(() => SettingsProvider.getInstance({ port: -5 })).toThrow(RangeError);
    expect(SettingsProvider.getLoadCount()).toBe(0);
    // A later valid call still works and becomes the singleton.
    expect(SettingsProvider.getInstance({ port: 4000 }).config.port).toBe(4000);
  });

  it("FAILURE: resetForTests() refuses to run outside NODE_ENV=test", () => {
    vi.stubEnv("NODE_ENV", "production");
    try {
      expect(() => SettingsProvider.resetForTests()).toThrow(/only allowed/);
    } finally {
      vi.unstubAllEnvs();
    }
  });
});

describe("Pattern 2: module-level const", () => {
  beforeEach(() => vi.resetModules()); // the only way to "reset" a module singleton
  afterEach(() => vi.unstubAllEnvs());

  it("returns the same reference and frozen config on repeated imports", async () => {
    const a = (await import("./settingsConst.js")).settings;
    const b = (await import("./settingsConst.js")).settings;
    expect(b).toBe(a);
    expect(Object.isFrozen(a)).toBe(true);
  });

  it("isolates tests: resetModules + new env gives a new value", async () => {
    vi.stubEnv("PORT", "5000");
    expect((await import("./settingsConst.js")).settings.port).toBe(5000);
    vi.resetModules();
    vi.stubEnv("PORT", "6000");
    expect((await import("./settingsConst.js")).settings.port).toBe(6000);
  });

  it("NEGATIVE: mutation is rejected", async () => {
    const { settings } = await import("./settingsConst.js");
    expect(() => {
      (settings as { port: number }).port = 1;
    }).toThrow(TypeError);
  });

  it("FAILURE: invalid PORT fails at import time", async () => {
    vi.stubEnv("PORT", "not-a-number");
    await expect(import("./settingsConst.js")).rejects.toThrow(RangeError);
  });
});

describe("Pattern 3: NestJS dependency injection", () => {
  const SETTINGS = Symbol("SETTINGS");
  const provider = { provide: SETTINGS, useFactory: () => ({ port: 3000 }) };

  it("injects the same reference into every consumer (default scope is singleton)", async () => {
    const moduleRef = await Test.createTestingModule({ providers: [provider] }).compile();
    expect(moduleRef.get(SETTINGS)).toBe(moduleRef.get(SETTINGS));
  });

  it("isolates tests: each testing module owns its own instance, no reset needed", async () => {
    const m1 = await Test.createTestingModule({ providers: [provider] }).compile();
    const m2 = await Test.createTestingModule({ providers: [provider] }).compile();
    expect(m1.get(SETTINGS)).not.toBe(m2.get(SETTINGS));
  });

  it("NEGATIVE: a transient provider is NOT a singleton", async () => {
    const transient = { ...provider, scope: Scope.TRANSIENT };
    const moduleRef = await Test.createTestingModule({ providers: [transient] }).compile();
    const a = await moduleRef.resolve(SETTINGS);
    const b = await moduleRef.resolve(SETTINGS);
    expect(a).not.toBe(b);
  });

  it("FAILURE: a throwing factory fails module compilation (fail fast at bootstrap)", async () => {
    const bad = {
      provide: SETTINGS,
      useFactory: () => {
        throw new Error("bad config");
      },
    };
    await expect(Test.createTestingModule({ providers: [bad] }).compile()).rejects.toThrow("bad config");
  });

  it("FAILURE: requesting an unregistered token throws", async () => {
    const moduleRef = await Test.createTestingModule({ providers: [] }).compile();
    expect(() => moduleRef.get(SETTINGS)).toThrow();
  });
});

describe("Why a singleton is not shared across threads or processes", () => {
  it("worker thread gets its own module instance (state is not shared)", async () => {
    increment();
    increment(); // main thread count is now >= 2
    const workerCount = await new Promise<number>((resolve, reject) => {
      const w = new Worker(fixture("workerProbe.mjs"));
      w.once("message", resolve);
      w.once("error", reject);
    });
    expect(workerCount).toBe(0);
  });

  it("child process (like a cluster worker) starts from its own fresh state", () => {
    increment(); // parent state is non-zero
    const out = execFileSync(process.execPath, [fixture("processProbe.mjs")]);
    expect(out.toString().trim()).toBe("1"); // child counted from 0, not from the parent's count
  });

  it("NEGATIVE: the child never modifies the parent's state", () => {
    const before = increment();
    execFileSync(process.execPath, [fixture("processProbe.mjs")]);
    expect(increment()).toBe(before + 1);
  });
});
