#!/usr/bin/env node
import process from 'node:process';
import { run } from './cli/run.js';
import { EXIT_USAGE } from './exit-codes.js';

try {
  process.exitCode = await run(process.argv.slice(2));
} catch (error) {
  const detail = error instanceof Error ? (error.stack ?? error.message) : String(error);
  process.stderr.write(`md-link-checker: unexpected error\n${detail}\n`);
  process.exitCode = EXIT_USAGE;
}
