export interface User {
  readonly id: string;
  readonly plan: "free" | "pro";
  readonly verified: boolean;
}

export interface ApiRequest {
  readonly token?: string;
  readonly body: unknown;
}

/** Travels down the chain. Handlers fill in `user` / `order` for the handlers after them. */
export interface Context {
  readonly request: ApiRequest;
  user?: User;
  order?: { orderId: string; quantity: number };
  readonly trace: string[]; // which handlers ran, in order (handy for tests and the runner)
}

export type Stage = "auth" | "validation" | "rateLimit" | "eligibility";

/** Typed result: success, or a rejection that says WHICH stage said no and why. */
export type Result = { ok: true; value: string } | { ok: false; stage: Stage; reason: string };

export const reject = (stage: Stage, reason: string): Result => ({ ok: false, stage, reason });

export type Next = () => Promise<Result>;

/** The contract. Reject = return a failure WITHOUT calling next(). Pass = return next(). */
export interface RequestHandler {
  handle(ctx: Context, next: Next): Promise<Result>;
}
