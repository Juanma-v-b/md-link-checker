# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
- Human-readable inventory and `--json` report, with `0` / `1` / `2` exit codes.

[Unreleased]: https://github.com/OWNER/md-link-checker/compare/main...HEAD
