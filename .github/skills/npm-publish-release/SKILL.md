---
name: npm-publish-release
description: Publish the click-builder package to npm and tag the release. Use when the user asks to publish, release, or prepare the package for npmjs.org.
license: MIT
compatibility: Requires git and npm.
metadata:
  author: GitHub Copilot
  version: "1.0"
---

# npm Publish Release

Use this skill when the user wants to publish the package to npm, prepare a release, or tag a new published version.

## Source of Truth

Follow [docs/release.md](docs/release.md) as the canonical runbook.

## Operating Rules

- Treat the release guide as the primary checklist.
- Verify the repository is in a publishable state before publishing.
- Do not publish if build, tests, BDD, coverage, or `npm pack --dry-run` fail.
- Keep versioning explicit and match the git tag to the published package version.
- Prefer small, reviewable release commits.

## Required Flow

1. Read [docs/release.md](docs/release.md) and the current [package.json](package.json).
2. Confirm the intended version bump.
3. Update package metadata and lockfile if needed.
4. Run the validation gate:
   - `npm run build`
   - `npm run test`
   - `npm run test:bdd`
   - `npm run test:coverage`
5. Run `npm pack --dry-run` and confirm the tarball contents.
6. Run `npm publish --access public`.
7. Create and push a matching git tag.
8. Push the release commit.

## Agent Output

When acting on this skill, report:

- the intended version
- the validation results
- the pack dry-run result
- the publish result
- the git tag that was created

If any required step fails, stop and explain the blocker before continuing.
