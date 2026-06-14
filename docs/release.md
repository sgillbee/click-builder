# Release Process

This project is published as an npm package: `@popscode/click-builder`.

Use this checklist for a human release or for an automation agent.

## Prerequisites

- You have write access to the Git repository.
- You are authenticated to npm (`npm whoami` succeeds).
- Node.js 20+ is installed.
- `ffmpeg` and `ffprobe` are installed on your machine for local validation.
- The working tree is clean or contains only the release changes you intend to publish.

## Release Steps

1. Decide the version bump.
- Use `patch` for bug fixes and documentation updates.
- Use `minor` for backwards-compatible feature additions.
- Use `major` for breaking changes.

2. Update the package version.
- Edit `package.json` and set the new version.
- If you prefer a command, use `npm version <patch|minor|major> --no-git-tag-version`.

3. Refresh the lockfile if needed.
- Run `npm install --package-lock-only`.
- This keeps `package-lock.json` aligned with `package.json`.

4. Run the validation gate.
- Run `npm run build`.
- Run `npm run test`.
- Run `npm run test:bdd`.
- Run `npm run test:coverage` and confirm the overall statement coverage is above 80%.

5. Check the package payload before publishing.
- Run `npm pack --dry-run`.
- Confirm the tarball includes `dist/`, `assets/`, `README.md`, and `LICENSE`.
- Confirm the package name and version are correct.

6. Publish to npm.
- Run `npm publish --access public`.
- For scoped packages, keep `publishConfig.access` set to `public` in `package.json`.

7. Tag the release in git.
- Create a git tag that matches the published version, for example `v0.1.0`.
- Push the tag to the remote.

8. Push the release commit.
- Push the branch to the remote repository.

## Recommended Command Sequence

```bash
npm whoami
npm version patch --no-git-tag-version
npm install --package-lock-only
npm run build
npm run test
npm run test:bdd
npm run test:coverage
npm pack --dry-run
npm publish --access public
git tag v0.1.1
git push origin main --tags
```

## Agent Notes

If you are an automation agent, stop and ask for help if any of these occur:

- npm authentication fails
- build, unit tests, BDD, or coverage fail
- the pack dry run shows missing files or unexpected files
- the package version in `package.json` does not match the intended release tag

When everything passes, the publish flow is ready to proceed without further design work.
