import { reject, type Context, type Next, type RequestHandler, type Result, type User } from "./types.js";

/** 1. Who are you? */
export class AuthHandler implements RequestHandler {
  constructor(private readonly users: ReadonlyMap<string, User>) {}

  async handle(ctx: Context, next: Next): Promise<Result> {
    ctx.trace.push("auth");
    const user = ctx.request.token ? this.users.get(ctx.request.token) : undefined;
    if (!user) return reject("auth", "Missing or invalid token");
    ctx.user = user; // later handlers rely on this
    return next();
  }
}

/** 2. Is the body well-formed? */
export class ValidationHandler implements RequestHandler {
  async handle(ctx: Context, next: Next): Promise<Result> {
    ctx.trace.push("validation");
    const body = ctx.request.body as { orderId?: unknown; quantity?: unknown } | null;
    const { orderId, quantity } = body ?? {};
    if (typeof orderId !== "string" || orderId === "") return reject("validation", "orderId must be a non-empty string");
    if (typeof quantity !== "number" || !Number.isInteger(quantity) || quantity < 1) {
      return reject("validation", "quantity must be a positive integer");
    }
    ctx.order = { orderId, quantity };
    return next();
  }
}

/** 3. Has this user used up their quota? (Counting is a side effect, so it must come after cheap checks.) */
export class RateLimitHandler implements RequestHandler {
  private readonly used = new Map<string, number>();

  constructor(private readonly limit: number) {}

  usedBy(userId: string): number {
    return this.used.get(userId) ?? 0;
  }

  async handle(ctx: Context, next: Next): Promise<Result> {
    ctx.trace.push("rateLimit");
    await Promise.resolve(); // pretend this is a Redis call: handlers may be async
    const userId = ctx.user!.id;
    if (this.usedBy(userId) >= this.limit) return reject("rateLimit", "Quota exceeded");
    this.used.set(userId, this.usedBy(userId) + 1);
    return next();
  }
}

/** 4. Business rules: is this user allowed to do THIS? */
export class EligibilityHandler implements RequestHandler {
  async handle(ctx: Context, next: Next): Promise<Result> {
    ctx.trace.push("eligibility");
    const { user, order } = ctx;
    if (!user!.verified) return reject("eligibility", "Account not verified");
    if (user!.plan === "free" && order!.quantity > 5) return reject("eligibility", "Free plan is limited to 5 items");
    return next();
  }
}
