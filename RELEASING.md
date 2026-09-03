# Releasing semantic-wrap

The release workflow is intentionally tokenless. Configure npm trusted publishing once for
each public package:

- `@semantic-wrap/core`
- `@semantic-wrap/en`
- `@semantic-wrap/ko`
- `@semantic-wrap/react`

Use the GitHub repository `woohyun-park/semantic-wrap` and workflow filename `release.yml` for
all four trusted publishers. The workflow runs on GitHub-hosted runners with Node.js 24,
requests `id-token: write`, and uses npm 11.

For every package-facing change, run `bun changeset` and commit the generated file. A push to
`main` creates or updates the fixed-version pull request. Merge that pull request only after
CI passes. The next release workflow publishes in dependency order through Changesets,
creates package tags and one `vX.Y.Z` GitHub Release, and runs the remote synchronization
check.

Run `bun run release:verify` locally to verify that all package manifests use one version.
The release workflow adds `--remote` to also compare npm, package git tags, and the latest
GitHub Release.
