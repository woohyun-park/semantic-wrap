# semantic-wrap repository guidance

## Architecture

- Keep `@semantic-wrap/core` independent from React, the DOM, and browser-only measurement APIs.
- Keep DOM measurement and wrapper-free `<br>` rendering inside `@semantic-wrap/react`.
- Keep language presets in their own packages; Core must not import `@semantic-wrap/en` or `@semantic-wrap/ko`.
- Preserve the existing source text unless the selected layout represents a real semantic improvement or fixes overflow.
- Public APIs are synchronous unless a separately approved design explicitly changes that contract.

## Examples and documentation

- Treat `apps/docs/src/example-cases.ts` as the source of truth for landing, Playground, process, and README comparison examples.
- Do not edit generated README example tables directly. Run `bun run examples:sync` after changing the catalog.
- Keep English as the default landing page, documentation language, README, and AI-documentation language. Link to Korean alternatives.
- Run `bun run ai-docs:sync` after changing the root English README.
- Do not duplicate the runtime skill registry or installed skill list in this file.

## Verification and releases

- Use Bun for repository scripts and dependency management.
- Run focused tests while developing and `bun run check` before shipping.
- Add a Changeset for every package-facing change. Docs-app, test-only, and internal-tooling changes do not require one.
- Keep the four public packages on the fixed shared version configured in `.changeset/config.json`.
- Do not commit `dogfood-output/`, Playwright reports, or other local diagnostics.
