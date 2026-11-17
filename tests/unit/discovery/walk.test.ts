import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { DiscoveryError } from '../../../src/errors.js';
import { DEFAULT_IGNORES } from '../../../src/discovery/ignore.js';
import { discoverMarkdownFiles } from '../../../src/discovery/walk.js';

const fixture = fileURLToPath(new URL('../../fixtures/project-a', import.meta.url));
const temporaryDirectories: string[] = [];

async function createTemporaryProject(
  files: Record<string, string>,
): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), 'md-link-checker-'));
  temporaryDirectories.push(directory);

  for (const [relativePath, content] of Object.entries(files)) {
    const absolutePath = path.join(directory, relativePath);
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, content, 'utf8');
  }

  return directory;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe('discoverMarkdownFiles', () => {
  it('walks directories recursively in a stable order', async () => {
    const files = await discoverMarkdownFiles(['.'], { cwd: fixture });

    expect(files.map((file) => path.relative(fixture, file).replace(/\\/g, '/'))).toEqual([
      'README.md',
      'docs/guide.md',
      'docs/nested/deep.md',
      'drafts/ignored.md',
    ]);
  });

  it('honours ignore rules', async () => {
    const files = await discoverMarkdownFiles(['.'], {
      cwd: fixture,
      ignore: ['drafts'],
    });

    expect(files).toHaveLength(3);
    expect(files.some((file) => file.includes('ignored.md'))).toBe(false);
  });

  it('accepts a single file as target', async () => {
    const files = await discoverMarkdownFiles(['README.md'], { cwd: fixture });

    expect(files).toEqual([path.join(fixture, 'README.md')]);
  });

  it('de-duplicates overlapping targets', async () => {
    const files = await discoverMarkdownFiles(['.', 'README.md'], {
      cwd: fixture,
      ignore: ['drafts'],
    });

    expect(files).toHaveLength(3);
  });

  it('skips default ignored directories', async () => {
    const directory = await createTemporaryProject({
      'README.md': '# Root',
      'docs/guide.md': '# Guide',
      'docs/notes.markdown': '# Notes',
      'node_modules/pkg/README.md': '# Package',
      'dist/output.md': '# Build',
      '.git/COMMIT_EDITMSG': 'not markdown',
    });

    const files = await discoverMarkdownFiles(['.'], {
      cwd: directory,
      ignore: DEFAULT_IGNORES,
    });

    expect(files.map((file) => path.relative(directory, file).replace(/\\/g, '/'))).toEqual([
      'README.md',
      'docs/guide.md',
      'docs/notes.markdown',
    ]);
  });

  it('rejects a target that is not Markdown', async () => {
    await expect(discoverMarkdownFiles(['package.json'], { cwd: fixture })).rejects.toThrow(
      DiscoveryError,
    );
  });

  it('rejects a target that does not exist', async () => {
    await expect(discoverMarkdownFiles(['missing.md'], { cwd: fixture })).rejects.toThrow(
      /path not found/,
    );
  });
});
