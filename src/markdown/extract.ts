import type { Root, RootContent, Text } from 'mdast';
import { toString as toPlainText } from 'mdast-util-to-string';
import type {
  Definition,
  DocumentAnalysis,
  RawReference,
  ReferenceUsage,
  SourcePosition,
} from '../types.js';
import { parseMarkdown } from './parse.js';
import { createHeadingSlugger, type HeadingSlugger } from './slug.js';

export interface ExtractOptions {
  absolutePath: string;
  relativePath: string;
  source: string;
}

interface ExtractState {
  references: RawReference[];
  definitions: Definition[];
  usages: ReferenceUsage[];
  anchors: string[];
  /** Identifiers that have at least one definition. */
  definedIds: Set<string>;
  /** Text nodes are scanned separately: CommonMark leaves undefined references as text. */
  textNodes: Text[];
}

/**
 * Extracts everything the validator needs from one document. No I/O: the
 * caller reads the file, this module only interprets it.
 */
export function extractDocument(options: ExtractOptions): DocumentAnalysis {
  const source = options.source;
  const state: ExtractState = {
    references: [],
    definitions: [],
    usages: [],
    anchors: [],
    definedIds: new Set(),
    textNodes: [],
  };

  visit(parseMarkdown(source), state, createHeadingSlugger());

  return {
    absolutePath: options.absolutePath,
    relativePath: options.relativePath.replace(/\\/g, '/'),
    anchors: state.anchors,
    references: state.references,
    definitions: state.definitions,
    usages: state.usages,
    unresolvedReferences: findUnresolvedReferences(source, state),
  };
}

function visit(node: Root | RootContent, state: ExtractState, slug: HeadingSlugger): void {
  switch (node.type) {
    case 'heading': {
      const text = toPlainText(node).trim();
      if (text !== '') {
        state.anchors.push(slug(text));
      }
      break;
    }

    case 'link':
      state.references.push({
        type: 'link',
        destination: node.url,
        label: toPlainText(node).trim(),
        position: positionOf(node),
      });
      break;

    case 'image':
      state.references.push({
        type: 'image',
        destination: node.url,
        label: node.alt ?? null,
        position: positionOf(node),
      });
      break;

    case 'definition': {
      // CommonMark resolves a label to its first definition, so later ones are
      // not rendered and must not be validated either.
      if (!state.definedIds.has(node.identifier)) {
        state.definedIds.add(node.identifier);
        state.definitions.push({
          id: node.identifier,
          destination: node.url,
          position: positionOf(node),
        });
        state.references.push({
          type: 'definition',
          destination: node.url,
          label: null,
          position: positionOf(node),
        });
      }
      break;
    }

    case 'linkReference':
    case 'imageReference':
      state.usages.push({
        id: node.identifier,
        isImage: node.type === 'imageReference',
        position: positionOf(node),
      });
      break;

    case 'text':
      state.textNodes.push(node);
      break;

    default:
      break;
  }

  if ('children' in node) {
    for (const child of node.children) {
      visit(child, state, slug);
    }
  }
}

/**
 * `[text][missing]` and `![alt][missing]` are valid Markdown syntax but, when
 * the label has no definition, CommonMark renders them literally. The AST
 * therefore keeps them as plain text, so the only way to see them is to scan
 * the source of text nodes (never code spans, code blocks or HTML).
 */
function findUnresolvedReferences(source: string, state: ExtractState): ReferenceUsage[] {
  const lineStarts = computeLineStarts(source);
  const unresolved: ReferenceUsage[] = [];

  for (const node of state.textNodes) {
    const start = node.position?.start.offset;
    const end = node.position?.end.offset;
    if (start === undefined || end === undefined) {
      continue;
    }

    const slice = source.slice(start, end);

    for (const match of slice.matchAll(EXPLICIT_REFERENCE)) {
      const first = match[1] ?? '';
      const second = match[2] ?? '';
      const rawId = second.trim() === '' ? first : second;
      const id = normalizeIdentifier(rawId);

      if (id === '' || state.definedIds.has(id)) {
        continue;
      }

      unresolved.push({
        id,
        isImage: (match[0] ?? '').startsWith('!'),
        position: positionAt(lineStarts, start + (match.index ?? 0)),
      });
    }
  }

  return unresolved;
}

/** `[text][id]`, `[text][]` and `![alt][id]`, ignoring escaped brackets and inline links. */
const EXPLICIT_REFERENCE = /(?<!\\)!?\[([^\]]*)\](?!\()\[([^\]]*)\]/g;

/** Label matching in CommonMark is case-insensitive and whitespace-collapsed. */
function normalizeIdentifier(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ').toLowerCase();
}

function positionOf(node: RootContent): SourcePosition {
  const start = node.position?.start;
  return { line: start?.line ?? 1, column: start?.column ?? 1 };
}

function computeLineStarts(source: string): number[] {
  const starts = [0];
  for (let index = 0; index < source.length; index += 1) {
    if (source.charCodeAt(index) === 10) {
      starts.push(index + 1);
    }
  }
  return starts;
}

function positionAt(lineStarts: readonly number[], offset: number): SourcePosition {
  let low = 0;
  let high = lineStarts.length - 1;

  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if ((lineStarts[middle] ?? 0) <= offset) {
      low = middle;
    } else {
      high = middle - 1;
    }
  }

  return { line: low + 1, column: offset - (lineStarts[low] ?? 0) + 1 };
}
