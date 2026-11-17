# md-link-checker

A small command-line tool that checks the links in your Markdown files and
tells you which ones are broken.

You can point it at a single file, a folder or a whole project. It finds every
link in the Markdown it reads and verifies that each one works: web pages that
no longer exist, local files that are not there, missing images and anchors
that lead to a section that doesn't exist. It works with any kind of project
and doesn't care which language or framework you use.

md-link-checker is free and open source (MIT), so you can use it, modify it and
share it.

## Installation

Node.js 20.11 or newer is required.

```bash
npm install -g md-link-checker
```

Or run it without installing anything:

```bash
npx md-link-checker README.md
```

## Usage

```bash
md-link-checker README.md     # a single file
md-link-checker docs          # a folder, subfolders included
md-link-checker .             # the whole project
```

It reports every problem with the file and the line where it appears, and then
shows a short summary of what was checked.

When everything is fine it exits with code `0`. If it finds problems it exits
with `1`, so you can use it in a CI pipeline and fail the build. Invalid
options exit with `2`.

### Options

| Option | Description |
| --- | --- |
| `--ignore <list>` | Folders or paths to skip, separated by commas |
| `--timeout <ms>` | How long to wait for a website before giving up (default: 10000) |
| `--concurrency <n>` | How many websites to check at the same time (default: 8) |
| `--skip-external` | Check only local files and anchors, without visiting websites |
| `--analyze-only` | List all the links found without checking them |
| `--json` | Print the result as JSON |
| `--strict` | Also fail when there are warnings, not only errors |
| `-h`, `--help` | Show help |
| `-v`, `--version` | Show the version |

## License

MIT
