import type { Context, RequestHandler, Result } from "./types.js";

export type Command = (ctx: Context) => Promise<Result>;

/** Chains handlers in the given order; the command runs only if every handler calls next(). */
export function createPipeline(handlers: readonly RequestHandler[], command: Command) {
  return async (ctx: Context): Promise<Result> => {
    let lastCalled = -1;

    const run = async (i: number): Promise<Result> => {
      if (i <= lastCalled) throw new Error("next() called multiple times"); // double-call guard
      lastCalled = i;
      if (i === handlers.length) return command(ctx); // end of the chain
      return handlers[i]!.handle(ctx, () => run(i + 1));
    };

    return run(0);
  };
}
