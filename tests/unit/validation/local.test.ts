import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createPathStatusCache, statPath } from '../../../src/validation/local.js';

let workspace: string;

beforeEach(async () => {
  workspace = await mkdtemp(path.join(tmpdir(), 'md-link-checker-local-'));
});

afterEach(async () => {
  await rm(workspace, { recursive: true, force: true });
});

describe('statPath', () => {
  it('detects files', async () => {
    const file = path.join(workspace, 'file.md');
    await writeFile(file, '# File', 'utf8');

    await expect(statPath(file)).resolves.toBe('file');
  });

  it('detects directories', async () => {
    const directory = path.join(workspace, 'docs');
    await mkdir(directory);

    await expect(statPath(directory)).resolves.toBe('directory');
  });

  it('detects missing paths', async () => {
    await expect(statPath(path.join(workspace, 'nope.md'))).resolves.toBe('missing');
  });

  it('detects a missing parent directory', async () => {
    await expect(statPath(path.join(workspace, 'a/b/c.md'))).resolves.toBe('missing');
  });
});

describe('createPathStatusCache', () => {
  it('resolves each path only once', async () => {
    const file = path.join(workspace, 'file.md');
    await writeFile(file, '# File', 'utf8');

    const statusOf = createPathStatusCache();
    await expect(statusOf(file)).resolves.toBe('file');

    await rm(file);
    await expect(statusOf(file)).resolves.toBe('file');
  });
});
