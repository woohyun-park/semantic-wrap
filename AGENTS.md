# semantic-wrap

## Goal

- The outcome is a headline that reads in meaningful phrases at every width and in every engine, at no visible cost: no overflow, no layout shift, smooth resize. A task is a means to that outcome. When a request treats a symptom, fix it, then name the cause and the larger change that would remove the whole class.
- Outside the contracts under Architecture and Releases, everything is open to redesign: algorithms, internal structure, tests, tooling, and the docs site.

## Ambition

- Plan against a specific, hard target and a judge that is not you: a failing test, a `bench:*` number against a frozen baseline, a three-engine browser spec, or a blind layout comparison. State what result would prove the idea wrong.
- Reproduce claims from raw measurements before building on them, including claims in `benchmarks/`, model cards, and the user's own hypothesis.
- A negative result is a deliverable. Record it in `benchmarks/` with Decision and Method so the next attempt starts from it.
- Do the work of each discipline the problem touches (typography, Korean and English phrase structure, layout engines, performance) instead of writing in its voice. Before finishing, attack the result as an adopter who would rather use `text-wrap: balance` or plain BudouX: build the counterexample headline.

## Architecture

- Core owns synchronous layout logic and stays independent of React, DOM measurement, and language presets. React owns DOM measurement and wrapper-free `<br>` rendering; English and Korean models stay in their own packages.
- Preserve source text outside selected line-break boundaries, and native wrapping unless a candidate improves semantics or fixes overflow. Keep public APIs synchronous unless the user approves a contract change.

## Sources

- Read local source, tests, and package READMEs for repository-owned APIs. Read `benchmarks/` first: each report is the baseline a new experiment must beat and holds only for the conditions it measured, so change the idea or a condition instead of rerunning it.
- `apps/docs/src/example-cases.ts` owns shared examples. After changing it, run `bun run examples:sync`; after changing the English README, run `bun run ai-docs:sync`.
- English is the default for the site, README, and AI docs; link Korean alternatives. Read `.impeccable.md` for UI design work.

## Work and verification

- Use Bun. Preserve pre-existing edits and keep local diagnostics untracked.
- During development, run the affected tests or `bun run check:fast`. Use `test:browser:react` for package fixtures and `test:browser:docs` for the site; pass the spec and `--project=chromium` to narrow a run.
- Run `bun run check` once on the final code before shipping. Repeat passed checks only after relevant edits, failures, or environment changes; commit/PR preparation alone does not invalidate results.
- React Doctor is optional targeted analysis. Do not refactor to improve its score or repeat a stalled scan without new evidence.
- See [DEVELOPMENT.md](DEVELOPMENT.md) for commands, server ownership, and benchmark prerequisites. Record the command, scope, result, and remaining issue when handing off work.

## Releases

- Branch from `develop` and target it with pull requests (rebase merge). `main` holds released code only and changes through `develop` → `main` release pull requests (merge commit, never squash or rebase) and the version pull request.
- Package-facing changes need a Changeset; docs-app, test-only, and internal-tooling changes do not. Keep the four public packages at the fixed shared version in `.changeset/config.json`.
- Follow [RELEASING.md](RELEASING.md) for release operations.
