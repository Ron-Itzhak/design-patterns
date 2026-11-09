import { loadSettings, type Settings } from "./loadSettings.js";

export type { Settings };

export class SettingsProvider {
  private static instance: SettingsProvider | undefined;
  private static loadCount = 0;

  public readonly config: Readonly<Settings>;

  private constructor(options: Partial<Settings>) {
    // Throws before the instance is assigned, so a failed load leaves no half-built singleton.
    this.config = loadSettings(options);
    SettingsProvider.loadCount++;
  }

  /**
   * Returns the single instance. The first call loads and freezes the settings.
   * Later calls may omit options, or pass options that match the loaded config;
   * options that conflict with the loaded config throw.
   */
  public static getInstance(options: Partial<Settings> = {}): SettingsProvider {
    const existing = SettingsProvider.instance;
    if (!existing) {
      return (SettingsProvider.instance = new SettingsProvider(options));
    }
    for (const [key, value] of Object.entries(options)) {
      const current = existing.config[key as keyof Settings];
      if (value !== current) {
        throw new Error(
          `SettingsProvider already initialised: cannot change "${key}" from ${JSON.stringify(current)} to ${JSON.stringify(value)}`,
        );
      }
    }
    return existing;
  }

  /** How many times settings were loaded (should never exceed 1 between resets). */
  public static getLoadCount(): number {
    return SettingsProvider.loadCount;
  }

  /**
   * TEST ONLY. Drops the instance so the next getInstance() loads afresh.
   * Refuses to run outside NODE_ENV=test so production code cannot re-initialise by accident.
   */
  public static resetForTests(): void {
    if (process.env.NODE_ENV !== "test") {
      throw new Error("resetForTests() is only allowed when NODE_ENV=test");
    }
    SettingsProvider.instance = undefined;
    SettingsProvider.loadCount = 0;
  }
}
