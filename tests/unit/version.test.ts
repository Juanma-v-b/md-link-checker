import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { VERSION } from '../../src/version.js';

const packageJson = JSON.parse(
  readFileSync(new URL('../../package.json', import.meta.url), 'utf8'),
) as { version: string };

describe('VERSION', () => {
  it('matches package.json', () => {
    expect(VERSION).toBe(packageJson.version);
  });

  it('is a valid semver string', () => {
    expect(VERSION).toMatch(/^\d+\.\d+\.\d+(?:[-+].+)?$/);
  });
});
