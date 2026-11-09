# Design Patterns in TypeScript

Small, simplified practice implementations of classic design patterns. Each pattern lives in its own folder under [patterns/](patterns/) with:

- the implementation,
- a Vitest spec (`*.spec.ts`) that proves the behaviour,
- a light `runner.ts` you can execute by hand to see the pattern working.

> The repo also contains a NestJS skeleton (`src/`, `test/`). It is not part of these exercises and can be ignored.

## Setup

```bash
npm install
```

Requires Node 20+ (developed on Node 24).

## Run everything

| Goal | Command |
| --- | --- |
| Run all pattern tests once | `npm test` |
| Watch mode | `npx vitest` |
| Run one pattern's tests | `npx vitest run patterns/<folder>` |
| Run a single test by name | `npx vitest run patterns/<folder> -t "part of the test name"` |
| Type-check | `npx tsc --noEmit -p tsconfig.json` |

## The patterns

| Pattern | Type | Scenario | Folder | Run the demo |
| --- | --- | --- | --- | --- |
| Singleton | Creational | One frozen settings object per process | [patterns/singleton](patterns/singleton) | `npm run run:singleton` |
| Builder | Creational | Building an immutable report request | [patterns/builder](patterns/builder) | `npm run run:builder` |
| Adapter | Structural | Normalising two shipping providers | [patterns/adapter](patterns/adapter) | `npm run run:adapter` |
| Flyweight | Structural | Sharing port metadata across many rates | [patterns/flyweight](patterns/flyweight) | `npm run run:flyweight` |
| Chain of Responsibility | Behavioral | API request checks (auth, validation, quota, eligibility) | [patterns/chain-of-responsibility](patterns/chain-of-responsibility) | `npm run run:chain` |
| Strategy | Behavioral | Interchangeable retry policies | [patterns/strategy](patterns/strategy) | `npm run run:strategy` |

---

## Singleton

One settings object, loaded once, frozen, shared by the whole process. The folder shows several ways to do it so they can be compared. See its own [README](patterns/singleton/README.md) for details.

- **Demo:** `npm run run:singleton` prints `PASS` or `FAIL` for each requirement (exit code 0 if all pass).
- **Tests:** `npx vitest run patterns/singleton`
- **Behaviour:** repeated calls return the same reference, the config cannot be mutated, re-initialising with the same options is accepted, and re-initialising with conflicting options is rejected.

## Builder

A fluent `ReportRequestBuilder` assembles an immutable `ReportRequest` (date range, filters, format, sort, compression).

- **Demo:** `npm run run:builder` builds two different reports with the same API, then shows two validation failures.
- **Tests:** `npx vitest run patterns/builder`
- **Behaviour:**
  - Every setter returns `this`, so calls chain.
  - All validation happens in `build()`: date range and format are required, an inverted date range is rejected, and `pdf` with compression is rejected.
  - Each `build()` returns a new, deeply frozen object. Changing the builder afterwards, or building twice, never affects an earlier result.

## Adapter

Two incompatible third-party shipping clients are translated into one internal contract, `ShippingRateProvider.getQuote()` returning a `RateQuote`.

- **Demo:** `npm run run:adapter` prints the normalised quote from each provider, the cheapest of both, and a deliberately malformed provider response being rejected.
- **Tests:** `npx vitest run patterns/adapter`
- **Behaviour:**
  - Provider A (`{ price: 120, currency: "USD" }`) and Provider B (`{ total_amount: 12000, currency_code: "USD", minor_units: true }`) both become `{ amountMinor: 12000, currency: "USD" }`.
  - Money is converted to integer minor units, with no floating-point errors.
  - Invalid currencies, timeouts and malformed payloads are all converted to one `ShippingProviderError` with a `code`.
  - Application code (`cheapestQuote`) only knows the interface.

## Flyweight

`PortMetadataFactory` returns one shared, frozen metadata object per port code, while each shipping rate keeps its own price, timestamp and shipment ID.

- **Demo:** `npm run run:flyweight` builds 1M rates with and without the flyweight and prints object counts and heap growth. The script runs Node with `--expose-gc` so the heap readings are less noisy. The numbers are illustrative and vary by machine.
- **Tests:** `npx vitest run patterns/flyweight`
- **Behaviour:**
  - The same port code (in any spelling, like `" nlrtm "`) returns the same object.
  - Different ports return different objects.
  - The shared metadata is frozen, and attempts to change it fail.
  - The factory reports how many objects were requested vs actually created.

## Chain of Responsibility

A request passes through ordered handlers: `AuthHandler`, `ValidationHandler`, `RateLimitHandler`, `EligibilityHandler`, and only then does the command run.

- **Demo:** `npm run run:chain` sends six requests (one valid, and one failing at each stage) and prints which handlers ran and the typed result.
- **Tests:** `npx vitest run patterns/chain-of-responsibility`
- **Behaviour:**
  - A handler rejects by returning a failure without calling `next()`, and the chain stops at the first rejection.
  - The result is typed: success, or a rejection naming the `stage` and `reason`.
  - Handlers run in the exact order given, and handlers may be async.
  - Calling `next()` twice throws an error.
  - After a rejection, later handlers and the command never run (so quota isn't used up by invalid requests).

## Strategy

A `RetryStrategy` (`shouldRetry`, `nextDelayMs`) is swapped behind `executeWithRetry()`: `NoRetry`, `FixedDelayRetry`, `ExponentialBackoffRetry` (cap and optional jitter).

- **Demo:** `npm run run:strategy` runs a flaky fake provider under each policy and prints the result and the delays that would have been waited. A fake sleep records delays, so the demo finishes instantly.
- **Tests:** `npx vitest run patterns/strategy`
- **Behaviour:**
  - Attempts are numbered from 1, and `attempt` means the attempt that just failed.
  - 5xx, 429 and network errors are retried, and other 4xx errors (400, 404) are not.
  - A `Retry-After` value on a 429 is respected, and the wait is never shorter than it.
  - After the last attempt, the last error is thrown.
  - `sleep` and `random` are injected, so tests check exact delays.

---

## Adding a new pattern

1. Create `patterns/<name>/` with the implementation, `<name>.spec.ts` and `runner.ts`.
2. Add a script to `package.json`, e.g. `"run:<name>": "tsx patterns/<name>/runner.ts"`.
3. Add a row and a section to this README.
