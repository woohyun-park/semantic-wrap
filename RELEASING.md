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
**Settings → Actions → General**.

### Branches

`develop` is the integration branch and the repository default. `main` contains released code
only, so it always matches the latest published version.

| Setting | `develop` | `main` |
| --- | --- | --- |
| Enforced by | Ruleset `develop` | Branch protection and ruleset `main-merge-method` |
| Pull request merge method | Rebase | Merge commit |
| Required checks | `check`, `node-smoke (22)`, `node-smoke (24)` | Same |
| Require linear history | Off | Off |
| Deletion and force pushes | Blocked | Blocked |
| Bypass | The release app only, for every rule | Nobody, administrators included |

Enable **Allow merge commits** and **Allow rebase merging** under **Settings → General** and keep
squash merging disabled.

Branch protection on a personally owned repository cannot let an app bypass the pull request
requirement, so every `develop` rule lives in its ruleset with the release app as the only bypass
actor. Administrators cannot push to `develop` directly either.

- Never squash or rebase a `develop` → `main` pull request. Without the merge commit the two
  branches stop sharing history, and Changesets that were already consumed are released again.
- Keep `develop` protected against deletion. **Automatically delete head branches** otherwise
  removes it when a release pull request merges.
- `develop` cannot require linear history, because the Release workflow brings the merge commits
  on `main` back into it.

## Release flow

1. Branch from `develop` and add a Changeset for every package-facing change:

   ```sh
   bun changeset
   ```

2. Rebase-merge the feature pull request into `develop` after CI passes. This publishes nothing.
3. To release, open a pull request from `develop` to `main` and merge it with a merge commit
   after CI passes.
4. The Release workflow creates or updates `chore: version packages` against `main` using the
   release app.
5. Required CI checks run automatically on that version pull request.
6. Merge the version pull request with a merge commit after its checks pass.
7. The next Release workflow publishes all four packages through npm Trusted Publishing.
8. The workflow creates package tags and one `vX.Y.Z` GitHub Release.
9. It installs the published packages in a temporary consumer project and verifies npm, Git tags,
   and the GitHub Release use the same version.
10. It brings `develop` up to date with `main`, which carries the version bump, changelogs, and
    consumed Changesets back. This is a fast-forward when nothing merged into `develop` during
    the release and a merge commit otherwise.

A release with no pending Changesets skips steps 4 to 8: the push to `main` verifies the version
that is already published and then updates `develop`.

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
- **The `develop` update fails:** a change merged into `develop` during the release conflicts
  with the version commit. Merge `main` into `develop` locally and resolve the conflict. Set the
  `develop` ruleset's enforcement to **Disabled**, push `develop`, and set it back to **Active**
  immediately. Do not open a rebase-merged pull request for it; that drops the merge commit.
- **A release pull request reports that `develop` is out of date:** the previous `develop` update
  did not run. Rerun the failed Release workflow job before merging.
- **Remote synchronization fails:** run `git fetch --tags`, then `bun run release:verify --remote`
  to identify whether npm, a package tag, or the unified GitHub Release is missing.
