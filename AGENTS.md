# Repository Instructions

When asked to publish, release, or prepare this package for npm:

- Follow [docs/release.md](docs/release.md) as the canonical runbook.
- Use the [npm publish release skill](.github/skills/npm-publish-release/SKILL.md) for agent-driven publish workflows.
- Do not publish unless build, tests, BDD, coverage, and `npm pack --dry-run` all pass.