# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-11-17

### Added

- Project scaffolding: TypeScript (NodeNext, strict), Vitest, CI workflow.
- Domain model, CLI entry point and argument parser with `--help` / `--version`.
- Initial README with installation and usage instructions.
- Recursive Markdown discovery with default exclusions (`node_modules`, `dist` and
  similar) and user-defined `--ignore` rules.
- GitHub-flavored Markdown parsing with accurate line and column positions.
- Extraction of inline links, images, autolinks, definitions and reference usages.
- Heading anchors generated with GitHub's own slug algorithm.
- Classification of destinations: external HTTP, local files, local images,
  same-document anchors and cross-document anchors.
- Detection of references without a definition and definitions that nothing uses.
- Local file and image existence checks, resolved relative to the source document.
- Fragment validation for same-document and cross-document links, including
  Markdown files outside the scanned targets.
- External URL checks with per-request timeout, redirect handling, URL
  de-duplication and bounded concurrency.
- Warnings instead of errors for anti-bot responses (`401`, `403`, `405`, `429`)
  and timeouts, so healthy links do not fail a build by accident.
- `--timeout`, `--concurrency`, `--skip-external`, `--analyze-only` and
  `--strict` wired into the CLI.
- Human-readable report grouped by document and the `--json` report, with
  `0` / `1` / `2` exit codes for CI.

[Unreleased]: https://github.com/Juanma-v-b/md-link-checker/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/Juanma-v-b/md-link-checker/releases/tag/v0.1.0
