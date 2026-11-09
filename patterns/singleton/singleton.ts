// Run script: checks that SettingsProvider is a proper singleton.
import { SettingsProvider } from './settingsProvider.js';

let failed = 0;
function check(name: string, ok: boolean): void {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
  if (!ok) failed++;
}

// 1. Private constructor + static getInstance()
// @ts-expect-error constructor is private (tsc fails here if it is not)
const _direct = (): SettingsProvider => new SettingsProvider({});
check('constructor is private (compile-time, see @ts-expect-error)', typeof _direct === 'function');

const a = SettingsProvider.getInstance({ port: 8080 });
const b = SettingsProvider.getInstance();
check('getInstance() returns the same instance', a === b);

// 2. Load once, freeze, reject conflicting reinitialisation
check('settings loaded exactly once', SettingsProvider.getLoadCount() === 1);
check('config is frozen', Object.isFrozen(a.config));
check('first options were applied', a.config.port === 8080);

let mutated = false;
try {
  (a.config as { port: number }).port = 1; // throws in strict mode (ES modules)
  mutated = a.config.port === 1;
} catch {
  /* expected */
}
check('config cannot be mutated', !mutated && a.config.port === 8080);

check('same options on re-init are accepted', SettingsProvider.getInstance({ port: 8080 }) === a);

let rejected = false;
try {
  SettingsProvider.getInstance({ port: 9999 });
} catch {
  rejected = true;
}
check('conflicting re-init is rejected', rejected);
check('config unchanged after rejected re-init', a.config.port === 8080);
check('still loaded exactly once', SettingsProvider.getLoadCount() === 1);

console.log(failed === 0 ? '\nAll checks passed' : `\n${failed} check(s) failed`);
process.exit(failed === 0 ? 0 : 1);
