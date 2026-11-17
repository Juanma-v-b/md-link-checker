import { fromMarkdown } from 'mdast-util-from-markdown';
import { gfmFromMarkdown } from 'mdast-util-gfm';
import { gfm } from 'micromark-extension-gfm';
import type { Root } from 'mdast';

/**
 * Parses Markdown into an mdast tree with GitHub Flavored Markdown enabled
 * (tables, autolink literals, strikethrough, task lists and footnotes).
 * Every node carries `position`, which is what makes line-accurate reports
 * possible.
 */
export function parseMarkdown(source: string): Root {
  return fromMarkdown(source, {
    extensions: [gfm()],
    mdastExtensions: [gfmFromMarkdown()],
  });
}
