# Releasing semantic-wrap

The release workflow publishes all four public packages at one shared version. npm publishing
is tokenless through Trusted Publishing; a repository-scoped GitHub App creates the version pull
request so its required CI checks start without manual approval.

## One-time setup

### npm Trusted Publishing

Configure one GitHub Actions trusted publisher in the npm settings for each package:

- `@semantic-wrap/core`
- `@semantic-wrap/en`
- `@semantic-wrap/ko`
- `@semantic-wrap/react`

Use the same values for all four packages:

| Field | Value |
| --- | --- |
| Organization or user | `woohyun-park` |
| Repository | `semantic-wrap` |
| Workflow filename | `release.yml` |
| Environment | Leave blank |
| Allowed actions | `npm publish` |

The workflow runs on a GitHub-hosted runner with Node.js 24, installs npm 11, and requests
`id-token: write`. Do not add an npm publish token. See the
[npm Trusted Publishing documentation](https://docs.npmjs.com/trusted-publishers/).

### GitHub release app

Create a GitHub App for release automation and install it only on the `semantic-wrap` repository.
It needs these repository permissions:

| Permission | Access |
| --- | --- |
| Contents | Read and write |
| Pull requests | Read and write |
| Metadata | Read-only (automatic) |

Generate a private key from the app settings, then add these values under the repository's
**Settings → Secrets and variables → Actions**:

| Kind | Name | Value |
| --- | --- | --- |
| Variable | `RELEASE_APP_CLIENT_ID` | The app's Client ID |
| Secret | `RELEASE_APP_PRIVATE_KEY` | The complete generated PEM private key |

The workflow exchanges these credentials for a token limited to the current repository. The token
expires after one hour and is revoked automatically when the job finishes. The app token is passed
directly to `changesets/action`; it is not an npm credential.

Keep **Allow GitHub Actions to create and approve pull requests** enabled under
**Settings → Actions → General**. Required checks for `main` should remain `check`,
`node-smoke (22)`, and `node-smoke (24)`.

## Release flow

1. Add a Changeset for every package-facing change:

   ```sh
   bun changeset
   ```

2. Merge the feature pull request after CI passes.
3. The Release workflow creates or updates `chore: version packages` using the release app.
4. Required CI checks run automatically on that version pull request.
5. Merge the version pull request after its checks pass.
6. The next Release workflow publishes all four packages through npm Trusted Publishing.
7. The workflow creates package tags and one `vX.Y.Z` GitHub Release.
8. It installs the published packages in a temporary consumer project and verifies npm, Git tags,
   and the GitHub Release use the same version.

Documentation, tests, and repository tooling do not require a Changeset unless they alter files
shipped in a public package.

## Verification

Check that local package manifests use one shared version:

```sh
bun run release:verify
```

Test locally packed package tarballs as a consumer:

```sh
bun run smoke:packages
```

Install the exact manifest version from npm and run the same runtime, SSR, and TypeScript checks:

```sh
bun run smoke:published
```

Compare the manifests with npm, package Git tags, and the latest GitHub Release:

```sh
bun run release:verify --remote
```

## Recovery

- **The version pull request has no CI:** confirm the GitHub App is installed on this repository,
  both Actions values exist, and the app has Contents and Pull requests write access. Do not add an
  empty commit to trigger CI.
- **npm publish returns E404 or a permission error:** verify the Trusted Publisher values on all
  four packages, especially `release.yml`, the blank Environment, and the `npm publish` action.
- **A Release workflow fails after the version pull request is merged:** fix the configuration and
  rerun the failed workflow job. Do not create another Changeset or bump the version again.
- **Remote synchronization fails:** run `git fetch --tags`, then `bun run release:verify --remote`
  to identify whether npm, a package tag, or the unified GitHub Release is missing.
