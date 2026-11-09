import { loadSettings } from "./loadSettings.js";

// Module-level const: ES modules are evaluated once per process (per thread), so this IS a singleton.
// PORT comes from the environment; an invalid value throws at import time (fail fast).
const port = process.env.PORT === undefined ? undefined : Number(process.env.PORT);
export const settings = loadSettings(port === undefined ? {} : { port });
