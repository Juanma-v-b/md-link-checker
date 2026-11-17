import GithubSlugger from 'github-slugger';

export type HeadingSlugger = (headingText: string) => string;

/**
 * Heading anchors must match what GitHub generates, otherwise every link to a
 * section would be a false positive. `github-slugger` implements exactly that
 * algorithm, including the `-1`, `-2` suffixes for repeated headings.
 */
export function createHeadingSlugger(): HeadingSlugger {
  const slugger = new GithubSlugger();
  return (headingText) => slugger.slug(headingText);
}

/**
 * GitHub resolves fragments case-insensitively in practice, so comparing
 * lowercased values avoids flagging `#Getting-Started` as broken.
 */
export function normalizeAnchor(fragment: string): string {
  return fragment.trim().toLowerCase();
}
