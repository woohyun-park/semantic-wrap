# Development

Use Bun and start with `git status --short` to identify existing work. Repository-owned
behavior is documented in package source, tests, and READMEs. Historical performance
tradeoffs live in `benchmarks/`; read the relevant report before designing another experiment.

## Verification loop

| Change | Development check |
| --- | --- |
| Core or language models | `bun test packages/core packages/en packages/ko` (or the affected test file) |
| React rendering, measurement, scheduling | `bun test packages/react` and `bun run test:browser:react tests/browser/semantic-wrap.spec.ts --project=chromium` (choose the affected spec) |
| Docs interactions or styling | `bun run site:typecheck` and `bun run test:browser:docs --project=chromium` |
| Package entrypoints, dependencies, or build output | `bun run smoke:packages` |
| Examples or English README | Run the corresponding sync command, then `bun run examples:check && bun run ai-docs:check` |
| General source validation | `bun run check:fast` |
| Final code before shipping | `bun run check` |

`check:fast` checks release versions, generated docs, package/tooling types, unit tests,
and docs types. It does not build or launch browsers. Type checking rejects unused
locals and parameters, so unused imports do not need a separate scanner.

`check` includes the source checks, clean package build, docs build/typecheck,
Chromium/Firefox/WebKit regressions, package contents, and publint. Run it once after
the final implementation. A later change needs the affected checks again; an unchanged
commit or PR description does not. Optional benchmark cases remain opt-in.

`smoke:packages` installs local tarballs into a temporary npm consumer and checks Node
imports, React SSR, and TypeScript with NodeNext resolution. It tests the shipped
artifacts instead of workspace source aliases. CI runs this separately on Node 22 and 24;
locally it uses the active Node version.

## Browser servers

- `test:browser:react` starts only the fixture server at `127.0.0.1:4191`, compiling
  current package source with Bun. It excludes `docs.spec.ts` and needs no docs build.
- `test:browser:docs` builds the site and starts only its preview at `127.0.0.1:4192`.
- `test:browser` builds the site and owns both servers for the complete suite.

Playwright starts and stops its servers; do not launch another copy or run overlapping
browser commands on the same ports. If startup fails, inspect the port owner and the
server output before retrying. Do not terminate an unrelated development server.
For missing browser binaries, install them with
`bunx playwright install chromium firefox webkit` (CI adds `--with-deps`).

## Performance and diagnostics

`bench:*` and `record:*` browser commands use only the package fixture server. Run a
benchmark only for a performance question, with its documented inputs and a frozen
baseline where required. Resize comparisons need `SEMANTIC_WRAP_RESIZE_BASELINE`;
scheduling comparisons also need `SEMANTIC_WRAP_OPTIONS_BASELINE`. See the relevant
report in `benchmarks/` for capture commands and interpretation limits.

Keep traces, videos, and screenshots in ignored `test-results/`, `playwright-report/`,
or `dogfood-output/`. Use existing regression tests first. React Doctor can supplement
a specific React investigation; its score is not a release gate. A stalled optional
tool is a limitation to report, not a reason to repeat the same scan.

For handoff, retain the branch, changed areas, verification commands and results,
unresolved issue, and next action. Do not copy raw private session logs into the repo.
