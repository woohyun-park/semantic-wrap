# semantic-wrap

## Architecture

- Core owns synchronous layout logic and stays independent of React, DOM measurement, and language presets. React owns DOM measurement and wrapper-free `<br>` rendering; English and Korean models stay in their own packages.
- Preserve source text outside selected line-break boundaries, and native wrapping unless a candidate improves semantics or fixes overflow. Keep public APIs synchronous unless the user approves a contract change.

## Sources

- Read local source, tests, and package READMEs for repository-owned APIs. Use `benchmarks/` for prior performance decisions before repeating experiments.
- `apps/docs/src/example-cases.ts` owns shared examples. After changing it, run `bun run examples:sync`; after changing the English README, run `bun run ai-docs:sync`.
- English is the default for the site, README, and AI docs; link Korean alternatives. Read `.impeccable.md` for UI design work.

## Work and verification

- Use Bun. Preserve pre-existing edits and keep local diagnostics untracked.
- During development, run the affected tests or `bun run check:fast`. Use `test:browser:react` for package fixtures and `test:browser:docs` for the site; pass the spec and `--project=chromium` to narrow a run.
- Run `bun run check` once on the final code before shipping. Repeat passed checks only after relevant edits, failures, or environment changes; commit/PR preparation alone does not invalidate results.
- React Doctor is optional targeted analysis. Do not refactor to improve its score or repeat a stalled scan without new evidence.
- See [DEVELOPMENT.md](DEVELOPMENT.md) for commands, server ownership, and benchmark prerequisites. Record the command, scope, result, and remaining issue when handing off work.

## Releases

- Package-facing changes need a Changeset; docs-app, test-only, and internal-tooling changes do not. Keep the four public packages at the fixed shared version in `.changeset/config.json`.
- Follow [RELEASING.md](RELEASING.md) for release operations.
