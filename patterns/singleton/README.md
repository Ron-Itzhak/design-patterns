# Singleton: `SettingsProvider`

A settings object that is loaded **once**, **frozen**, and shared by the whole process. The folder implements the same idea three ways so they can be compared.

| File | Purpose |
| --- | --- |
| `loadSettings.ts` | Shared pure function: merge defaults, validate the port, return a frozen config. |
| `settingsProvider.ts` | Pattern 1: class singleton (private constructor, `getInstance()`, test-only reset). |
| `settingsConst.ts` | Pattern 2: module-level `export const`. |
| `singleton.spec.ts` | Vitest suite covering all three patterns. |
| `singleton.ts` | Standalone check script. Run with `npx tsx singleton.ts` and it prints PASS or FAIL per requirement. |
| `fixtures/` | Tiny plain-JS modules used to show that state is not shared across threads or processes. |

## Run commands

Run everything from the repo root (`design-patterns/`) unless noted. Install dependencies first with `npm install`.

| Goal | Command |
| --- | --- |
| Run the singleton tests once | `npx vitest run patterns/singleton` |
| Watch mode (re-run on save) | `npx vitest patterns/singleton` |
| Run one test by name | `npx vitest run patterns/singleton -t "conflicting re-init"` |
| Run the whole repo's tests | `npm test` |
| Coverage report | `npx vitest run patterns/singleton --coverage` |
| Type-check | `npx tsc --noEmit -p tsconfig.json` |
| Run the PASS/FAIL check script | `cd patterns/singleton` then `npx tsx singleton.ts` |

The check script exits with code 0 when every check passes and 1 otherwise, so it can be used in CI.

## Behaviour of the class singleton

- **Private constructor and `getInstance(options?)`.** The first call builds the instance. Later calls return the same reference.
- **Load once and freeze.** Settings load in the constructor and are frozen with `Object.freeze`. `getLoadCount()` makes "exactly once" observable.
- **Conflicting re-initialisation is rejected.** Calling `getInstance({ port: 9999 })` after the instance exists with a different port throws. Calling with the same values, or with none, is fine.
- **A failed load leaves nothing behind.** Validation throws inside the constructor, before the instance is assigned. The next valid call can still initialise normally.

Note: `private` is enforced by the TypeScript compiler only. At runtime `new SettingsProvider()` would still work if someone casts around the type system. If that matters, use a `#private` constructor-token trick or just use Pattern 2.

## Test-only reset and the risks of global mutable state

`SettingsProvider.resetForTests()` clears the instance and the load counter. It throws unless `NODE_ENV === "test"` (Vitest sets this automatically), so production code cannot re-initialise the singleton by accident. There is a test proving the guard works.

A singleton is global state. Even though this one is frozen, the pattern carries risks:

- **Test pollution.** State leaks from one test to the next, and results depend on test order. That is why a reset exists, and why every test in the suite starts with `beforeEach(resetForTests)`.
- **Hidden dependencies.** Any function can call `getInstance()`, so a signature no longer shows what the code needs. This makes code harder to read and to reason about.
- **Hard to substitute.** Mocking means resetting global state or module-level patching rather than passing a fake in.
- **Initialisation order.** Whoever calls `getInstance(options)` first wins. A late caller with different options gets an error, or silently gets someone else's config if you don't reject conflicts.
- **Mutable state makes it worse.** This singleton is frozen, which removes most of the danger. A mutable singleton adds race-like bugs: two request handlers changing the same object, with no clear owner.
- **A test-only reset is itself a hole in the design.** It is a backdoor that exists purely for tests. The guard limits the damage but does not remove it. The cleaner fix is to avoid needing a reset at all (see Nest DI below).

## Validation (Vitest)

The suite has 19 tests. Each pattern has at least one failure scenario and one negative test.

| Area | Pattern 1: class | Pattern 2: module const | Pattern 3: Nest DI |
| --- | --- | --- | --- |
| Reference identity | same object on repeated `getInstance()` | same object on repeated `import` | `get()` returns the same object |
| Stable config | frozen, loaded once | frozen | n/a (plain object) |
| Test isolation | `resetForTests()` in `beforeEach` | `vi.resetModules()` then re-import | new testing module per test, no reset |
| Negative test | conflicting re-init rejected; mutation throws | mutation throws | `Scope.TRANSIENT` provider is *not* a singleton |
| Failure scenario | invalid port throws and leaves no instance; reset refused outside test env | invalid `PORT` throws at import time | throwing factory fails module compile; unknown token throws |

## Why worker threads and clustered processes do not share a singleton

A singleton is "one per **module instance**", not "one per application".

- **`worker_threads`.** Each worker is a separate JavaScript isolate with its own heap and its own module cache. Importing the same file in a worker evaluates it again, so the class static or module const is created a second time. Workers can share raw memory only through `SharedArrayBuffer` or messages. Objects are copied, not shared.
- **`cluster` and `child_process`.** These are separate OS processes with separate memory. `cluster` forks a copy of the app per worker, so each worker has its own `SettingsProvider`.

The last describe block in the spec shows this. The main thread increments a counter in `fixtures/counter.mjs`. A worker thread importing the same file reads `0`. A child process increments to `1`, not to the parent's count. The parent's own count is unaffected. The probe is plain JS because the workers cannot easily load the `.ts` source under Vitest, but a class static behaves exactly the same way.

Practical consequence: a singleton is safe for **read-only config** that every process can load identically. For anything that must be shared and changing (counters, caches, rate limits, sessions), use an external store such as Redis or a database.

## Interview discussion

### Module-level const or NestJS DI: which is clearer?

Prefer the simplest thing that works:

- **Module-level `export const`** (`settingsConst.ts`) is the most straightforward TypeScript. ES modules are evaluated once, so you get a singleton with no class, no `getInstance()`, and no reset logic. Downsides: it runs at import time (side effects, errors surface during import), it is hard to configure with runtime options, and tests need `vi.resetModules()`.
- **Class singleton** adds ceremony (private constructor, static state) for little gain in a modern TypeScript codebase. It is mainly useful when you need lazy initialisation with caller-supplied options, which is the case here.
- **NestJS DI** is the clearest in a Nest app. Providers are singletons by default, dependencies are visible in constructors, and each test builds its own module, so **no reset mechanism is needed**. That removes the main weakness of the other two. The cost is the framework itself: do not pull Nest in just to get a singleton.

Recommendation: in a Nest app, use a provider. In a plain script or library, use the module-level const. Keep the class singleton for when lazy, option-driven initialisation really is required.

### What changes in serverless deployments?

- **Instances are many and short-lived.** Each cold start creates a new container with a fresh singleton. Many concurrent instances run side by side, so there is no "one per application".
- **Warm reuse is not guaranteed.** A singleton can survive between invocations in a warm container, but you cannot rely on it. Do not store request- or user-specific data in it, because a later invocation might see it.
- **Config loading costs cold-start time.** Load settings lazily or keep them small. Do not make network calls at import time unless you accept the latency.
- **Config is not shared or updatable.** Changing a setting means a redeploy or waiting for containers to recycle. Anything that must be consistent across instances belongs in an external store.
- **Frozen, read-only config remains a good fit.** That is exactly what this singleton holds, so it works well in serverless. Mutable shared state does not.
