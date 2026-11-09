export interface Settings {
  readonly appName: string;
  readonly port: number;
  readonly env: string;
}

export const DEFAULTS: Settings = { appName: "my-app", port: 3000, env: "development" };

/** Merge defaults with options, validate, and return a frozen config. Throws on invalid input. */
export function loadSettings(options: Partial<Settings> = {}): Readonly<Settings> {
  const merged = { ...DEFAULTS, ...options };
  if (!Number.isInteger(merged.port) || merged.port < 1 || merged.port > 65535) {
    throw new RangeError(`Invalid port: ${String(merged.port)}`);
  }
  return Object.freeze(merged);
}
