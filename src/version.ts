import { readFileSync } from 'node:fs';

/**
 * Single source of truth: the version in `package.json`.
 * The relative path works both from `src/` (tests) and from `dist/` (build),
 * because `package.json` always sits one level above the module.
 */
const packageJsonUrl = new URL('../package.json', import.meta.url);
const packageJson = JSON.parse(readFileSync(packageJsonUrl, 'utf8')) as { version: string };

export const VERSION = packageJson.version;
