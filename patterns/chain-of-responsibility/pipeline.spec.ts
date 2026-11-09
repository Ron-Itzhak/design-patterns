import { describe, expect, it, vi } from "vitest";
import { AuthHandler, EligibilityHandler, RateLimitHandler, ValidationHandler } from "./handlers.js";
import { createPipeline } from "./pipeline.js";
import type { Context, RequestHandler, Result, User } from "./types.js";

const users = new Map<string, User>([
  ["free", { id: "u1", plan: "free", verified: true }],
  ["pro", { id: "u2", plan: "pro", verified: true }],
  ["unverified", { id: "u3", plan: "pro", verified: false }],
]);
const good = { orderId: "A1", quantity: 2 };

function setup(limit = 10) {
  const rateLimit = new RateLimitHandler(limit);
  const command = vi.fn(async (ctx: Context): Promise<Result> => {
    ctx.trace.push("command");
    return { ok: true, value: "done" };
  });
  const pipeline = createPipeline([new AuthHandler(users), new ValidationHandler(), rateLimit, new EligibilityHandler()], command);
  const send = async (token: string | undefined, body: unknown) => {
    const ctx: Context = { request: { token, body }, trace: [] };
    return { result: await pipeline(ctx), trace: ctx.trace };
  };
  return { send, command, rateLimit };
}

describe("success", () => {
  it("runs every handler in order, then the command", async () => {
    const { send, command } = setup();
    const { result, trace } = await send("free", good);
    expect(result).toEqual({ ok: true, value: "done" });
    expect(trace).toEqual(["auth", "validation", "rateLimit", "eligibility", "command"]);
    expect(command).toHaveBeenCalledOnce();
  });
});

describe("rejection at each stage stops the chain", () => {
  it.each([
    ["auth", undefined, good, ["auth"]],
    ["auth", "wrong-token", good, ["auth"]],
    ["validation", "free", { orderId: "", quantity: 1 }, ["auth", "validation"]],
    ["validation", "free", { orderId: "A", quantity: 1.5 }, ["auth", "validation"]],
    ["validation", "free", null, ["auth", "validation"]],
    ["eligibility", "unverified", good, ["auth", "validation", "rateLimit", "eligibility"]],
    ["eligibility", "free", { orderId: "A", quantity: 6 }, ["auth", "validation", "rateLimit", "eligibility"]],
  ] as const)("%s (token=%s)", async (stage, token, body, expectedTrace) => {
    const { send, command } = setup();
    const { result, trace } = await send(token, body);
    expect(result).toMatchObject({ ok: false, stage });
    expect(trace).toEqual(expectedTrace);
    expect(command).not.toHaveBeenCalled(); // side effect skipped
  });

  it("rateLimit rejects once quota is used up", async () => {
    const { send, command } = setup(1);
    expect((await send("free", good)).result.ok).toBe(true);
    const second = await send("free", good);
    expect(second.result).toMatchObject({ ok: false, stage: "rateLimit" });
    expect(second.trace).toEqual(["auth", "validation", "rateLimit"]);
    expect(command).toHaveBeenCalledTimes(1);
  });

  it("a rejection before rateLimit does not consume quota", async () => {
    const { send, rateLimit } = setup();
    await send(undefined, good); // auth fails
    await send("free", { orderId: "", quantity: 1 }); // validation fails
    expect(rateLimit.usedBy("u1")).toBe(0);
  });

  it("pro plan may order more than 5", async () => {
    const { send } = setup();
    expect((await send("pro", { orderId: "A", quantity: 50 })).result.ok).toBe(true);
  });
});

describe("ordering and async", () => {
  it("order is exactly the order given, even with a slow async handler", async () => {
    const trace: string[] = [];
    const make = (name: string, delayMs: number): RequestHandler => ({
      async handle(_ctx, next) {
        await new Promise((r) => setTimeout(r, delayMs));
        trace.push(name);
        return next();
      },
    });
    const pipeline = createPipeline([make("slow", 20), make("fast", 0), make("medium", 5)], async () => ({ ok: true, value: "x" }));
    await pipeline({ request: { body: null }, trace: [] });
    expect(trace).toEqual(["slow", "fast", "medium"]);
  });
});

describe("next() guard", () => {
  it("throws if a handler calls next() twice", async () => {
    const command = vi.fn(async (): Promise<Result> => ({ ok: true, value: "x" }));
    const buggy: RequestHandler = {
      async handle(_ctx, next) {
        await next();
        return next(); // bug
      },
    };
    const pipeline = createPipeline([buggy], command);
    await expect(pipeline({ request: { body: null }, trace: [] })).rejects.toThrow(/multiple times/);
    expect(command).toHaveBeenCalledTimes(1); // the second call never re-ran the command
  });
});
