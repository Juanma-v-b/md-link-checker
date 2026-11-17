import type { CheckResult } from '../types.js';

/** Serialises the report for machines. The shape is versioned by the CLI. */
export function formatJsonReport(result: CheckResult): string {
  return `${JSON.stringify(result, null, 2)}\n`;
}
