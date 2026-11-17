import type { CheckResult, ClassifiedReference, ProjectAnalysis } from '../types.js';

/**
 * Terminal report: an inventory of every reference grouped by document, then
 * the problems found, then a one-line summary. Positions use `file:line:col`
 * so editors and terminals can make them clickable.
 */
export function formatHumanReport(analysis: ProjectAnalysis, result: CheckResult): string {
  const lines: string[] = [];
  const { summary } = result;
  const referencesByDocument = groupReferences(analysis);

  lines.push(
    `Analyzed ${count(summary.files, 'file')} and ${count(summary.references, 'reference')}.`,
    '',
  );

  for (const document of analysis.documents) {
    lines.push(document.relativePath);

    const references = referencesByDocument.get(document.relativePath) ?? [];
    if (references.length === 0) {
      lines.push('  (no references)');
    }

    for (const reference of references) {
      const position = `${reference.reference.position.line}:${reference.reference.position.column}`;
      lines.push(`  ${position.padEnd(8)} ${reference.kind.padEnd(22)} ${reference.reference.destination}`);
    }

    lines.push('');
  }

  if (result.issues.length === 0) {
    lines.push('No problems found.');
  } else {
    lines.push('Problems');
    for (const issue of result.issues) {
      const location = `${issue.relativePath}:${issue.position.line}:${issue.position.column}`;
      lines.push(`  ${location}  ${issue.severity.padEnd(8)} ${issue.code}  ${issue.message}`);
    }
  }

  lines.push(
    '',
    `Summary: ${count(summary.files, 'file')}, ${count(summary.references, 'reference')}, ` +
      `${count(summary.errors, 'error')}, ${count(summary.warnings, 'warning')} ` +
      `(${summary.durationMs} ms)`,
    '',
    'Note: only references and definitions were checked; link validation is not available yet.',
    '',
  );

  return lines.join('\n');
}

function groupReferences(analysis: ProjectAnalysis): Map<string, ClassifiedReference[]> {
  const grouped = new Map<string, ClassifiedReference[]>();

  for (const reference of analysis.references) {
    const relativePath = reference.document.relativePath;
    const bucket = grouped.get(relativePath);
    if (bucket === undefined) {
      grouped.set(relativePath, [reference]);
    } else {
      bucket.push(reference);
    }
  }

  return grouped;
}

function count(value: number, singular: string): string {
  return `${value} ${value === 1 ? singular : `${singular}s`}`;
}
