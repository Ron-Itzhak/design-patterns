/** INTRINSIC state: identical for every rate that uses this port, so it can be shared. */
export interface PortMetadata {
  readonly code: string;
  readonly country: string;
  readonly timezone: string;
}

/** Stand-in for a database / JSON feed. Parsing a row creates fresh objects and strings. */
const RAW_PORTS: Readonly<Record<string, string>> = {
  NLRTM: '{"code":"NLRTM","country":"Netherlands","timezone":"Europe/Amsterdam"}',
  CNSHA: '{"code":"CNSHA","country":"China","timezone":"Asia/Shanghai"}',
  SGSIN: '{"code":"SGSIN","country":"Singapore","timezone":"Asia/Singapore"}',
  USLAX: '{"code":"USLAX","country":"United States","timezone":"America/Los_Angeles"}',
  DEHAM: '{"code":"DEHAM","country":"Germany","timezone":"Europe/Berlin"}',
};

export const KNOWN_PORT_CODES = Object.keys(RAW_PORTS);

/** "  nlrtm " -> "NLRTM". Throws on anything that is not a known port. */
export function canonicalCode(input: string): string {
  const code = input.trim().toUpperCase();
  if (!/^[A-Z]{5}$/.test(code)) throw new Error(`Invalid port code: "${input}"`);
  if (!(code in RAW_PORTS)) throw new Error(`Unknown port: ${code}`);
  return code;
}

/** The expensive part: build a brand-new frozen metadata object. */
export function loadPortMetadata(code: string): PortMetadata {
  return Object.freeze(JSON.parse(RAW_PORTS[canonicalCode(code)]!) as PortMetadata);
}

/** The Flyweight factory: one shared PortMetadata per canonical code. */
export class PortMetadataFactory {
  private readonly cache = new Map<string, PortMetadata>();
  private requests = 0;

  get(code: string): PortMetadata {
    this.requests++;
    const key = canonicalCode(code);
    let port = this.cache.get(key);
    if (!port) {
      port = loadPortMetadata(key);
      this.cache.set(key, port);
    }
    return port;
  }

  /** requests = how many times callers asked; created = how many objects actually exist. */
  stats(): { requests: number; created: number } {
    return { requests: this.requests, created: this.cache.size };
  }
}
