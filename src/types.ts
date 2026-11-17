/**
 * Domain model shared by discovery, analysis, validation and reporting.
 *
 * Everything lives in a single module on purpose: the layers never import
 * types from each other, which keeps the dependency graph acyclic and the
 * contracts explicit.
 */

/** Severity of a finding. Only `error` makes the CLI fail (unless `--strict`). */
export type Severity = 'error' | 'warning';

/** What a destination points to, once resolved against the source document. */
export type ReferenceKind =
  | 'external-http'
  | 'local-file'
  | 'local-image'
  | 'same-document-anchor'
  | 'cross-document-anchor'
  | 'other';

/**
 * Stable identifiers used by reports, the JSON output and the tests.
 * New codes are added in a minor release; existing ones are never renamed.
 */
export type IssueCode =
  | 'BROKEN_LOCAL_FILE'
  | 'MISSING_ANCHOR'
  | 'UNDEFINED_REFERENCE'
  | 'UNUSED_DEFINITION'
  | 'HTTP_ERROR'
  | 'HTTP_BLOCKED'
  | 'HTTP_TIMEOUT'
  | 'REDIRECT_LOOP'
  | 'NETWORK_ERROR'
  | 'INVALID_PATH';

/** 1-based line and column, as reported by the Markdown parser. */
export interface SourcePosition {
  line: number;
  column: number;
}

/** A reference exactly as written in the document, before classification. */
export interface RawReference {
  type: 'link' | 'image' | 'autolink' | 'definition';
  /** Destination as written by the author (may contain escapes or `%20`). */
  destination: string;
  /** Visible text of the link or the alt text of the image; `null` for definitions. */
  label: string | null;
  position: SourcePosition;
}

/**
 * A `[id]: destination` definition.
 * It is validated once at its own position, not once per usage, so a single
 * broken URL does not produce one issue per reference to it.
 */
export interface Definition {
  id: string;
  destination: string;
  position: SourcePosition;
}

/** A `[text][id]` usage that needs a matching definition. */
export interface ReferenceUsage {
  id: string;
  isImage: boolean;
  position: SourcePosition;
}

/** Result of analysing a single document. Pure: no I/O after reading the file. */
export interface DocumentAnalysis {
  absolutePath: string;
  relativePath: string;
  /** Heading anchors in document order, slugged like GitHub does. */
  anchors: string[];
  references: RawReference[];
  definitions: Definition[];
  usages: ReferenceUsage[];
  /** Usages whose `id` has no matching definition. */
  unresolvedReferences: ReferenceUsage[];
}

/** A reference with its destination resolved against the source document. */
export interface ClassifiedReference {
  document: DocumentAnalysis;
  reference: RawReference;
  kind: ReferenceKind;
  /** Destination without the fragment, as written. */
  href: string;
  /** Fragment without the leading `#`, if any. */
  anchor: string | null;
  /** Absolute target path for local references, `null` otherwise. */
  resolvedPath: string | null;
}

/** A single finding, ready to be printed or serialised. */
export interface Issue {
  code: IssueCode;
  severity: Severity;
  relativePath: string;
  position: SourcePosition;
  message: string;
  /** Destination as written in the Markdown. */
  reference: string;
}

export interface DocumentReport {
  relativePath: string;
  references: number;
}

export interface CheckSummary {
  files: number;
  references: number;
  uniqueUrls: number;
  errors: number;
  warnings: number;
  durationMs: number;
}

/** Machine-readable report consumed by `--json` and by CI integrations. */
export interface CheckResult {
  schemaVersion: 1;
  summary: CheckSummary;
  documents: DocumentReport[];
  issues: Issue[];
}

/** Normalised CLI flags, after validation. */
export interface CliOptions {
  targets: string[];
  /** Extra ignore rules supplied by the user; defaults are merged later. */
  ignore: string[];
  timeoutMs: number;
  concurrency: number;
  json: boolean;
  strict: boolean;
  skipExternal: boolean;
  analyzeOnly: boolean;
}

/** Outcome of parsing `process.argv`: a command plus its options. */
export type ParsedArgs =
  | { command: 'check'; options: CliOptions }
  | { command: 'help' }
  | { command: 'version' };
