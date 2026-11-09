import { AuthHandler, EligibilityHandler, RateLimitHandler, ValidationHandler } from "./handlers.js";
import { createPipeline } from "./pipeline.js";
import type { ApiRequest, Context, User } from "./types.js";

const users = new Map<string, User>([
  ["tok-free", { id: "u1", plan: "free", verified: true }],
  ["tok-new", { id: "u2", plan: "free", verified: false }],
]);

const pipeline = createPipeline(
  [new AuthHandler(users), new ValidationHandler(), new RateLimitHandler(2), new EligibilityHandler()],
  async (ctx) => {
    ctx.trace.push("command");
    return { ok: true, value: `Order ${ctx.order!.orderId} placed` };
  },
);

async function send(label: string, request: ApiRequest) {
  const ctx: Context = { request, trace: [] };
  const result = await pipeline(ctx);
  console.log(`${label}\n  ran: ${ctx.trace.join(" -> ")}\n  result:`, result);
}

await send("1. valid request", { token: "tok-free", body: { orderId: "A1", quantity: 2 } });
await send("2. no token", { body: { orderId: "A1", quantity: 2 } });
await send("3. bad body", { token: "tok-free", body: { orderId: "", quantity: 2 } });
await send("4. unverified user", { token: "tok-new", body: { orderId: "A2", quantity: 1 } });
await send("5. too many items for free plan", { token: "tok-free", body: { orderId: "A3", quantity: 9 } });
await send("6. third request, quota (2) used up", { token: "tok-free", body: { orderId: "A4", quantity: 1 } });
