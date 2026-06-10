# Click Builder

CLI tooling for turning an existing lyric video into a click-track video workflow. The project is built as a set of small composable tools that pass structured data between phases, with FFmpeg handling the media work.

## What It Does

- Parse a YAML song configuration into a validated AST
- Generate a beat-accurate timeline from tempo, meter, and structure
- Render layered click/cue audio from source fragments
- Mux the generated audio back into the original video without re-encoding the video stream

## Requirements

- Node.js 20+
- FFmpeg installed and available on `PATH`
- On Windows, install FFmpeg with `winget install Gyan.FFmpeg`
- A project YAML config file

## Install

```bash
npm install
```

## Global CLI Install

Install globally from this repository so the `click-builder` command is available on your `PATH`:

```bash
npm install -g .
```

Then run:

```bash
click-builder <config.yaml> <input-video> <output-video>
```

## Scripts

```bash
npm run test
npm run test:coverage
npm run test:bdd
npm run fixtures:video-sync
npm run test:bdd:real
npm run test:bdd:real:muxsync
```

## Tests

- Unit tests live next to the source they exercise as `*.test.ts` files.
- BDD tests live under `tests/bdd/<feature>/` as `.feature` files with matching step definitions.
- Coverage is available via `npm run test:coverage`.
- Real mux sync fixtures are generated with `npm run fixtures:video-sync` into `tests/fixtures/video-sync/`.
- Targeted real mux sync checks run with `npm run test:bdd:real:muxsync`.
- For real/mock selection, pass npm flags directly, e.g. `npm run test:bdd --real --muxsync`.
- For ad-hoc BDD selection, pass cucumber args through `npm run test:bdd:run -- ...`.

Example:

```bash
npm run test:bdd --real --muxsync

npm run test:bdd:run -- --tags "@real and @muxsync and not @pending" --format html:test-artifacts/bdd/real/custom-report.html
```

## Real Mux Sync Workflow

1. Regenerate deterministic video fixtures:

```bash
npm run fixtures:video-sync
```

2. Run focused real mux sync scenarios (`D = 0`, `D > 0`, `D < 0`):

```bash
npm run test:bdd:real:muxsync
```

3. Run mux-sync scenarios and inspect captured muxed outputs:

```bash
npm run test:bdd --real --muxsync
```

Muxed output artifacts are always written under `test-artifacts/bdd/real/mux-sync/muxed-output/`.

BDD HTML reports are written under `test-artifacts/bdd/`.

## Project Structure

- `docs/` - product and planning documentation
- `openspec/` - proposal, design, specs, and implementation tasks
- `src/` - CLI pipeline source code
- `.github/skills/` - Copilot skills used for implementation and quality workflows

## Configuration

The pipeline is driven by YAML. A config should define the song name, tempo, base time signature, downbeat offset, and song structure.

Example:

```yaml
name: "Great Are You Lord"
tempo: 72
time_signature: 6/8
video_downbeat_offset_ms: 4230
structure:
  - section: "Count-in"
    measures: 1
  - section: "Verse 1"
    measures: 8
  - section: "Bridge"
    measures: 4
    time_signature: 4/4
```

## Notes

- Time values are stored as floating-point millisecond values in the internal JSON contracts.
- The metronome click is the foundation layer; cues are mixed on top.
- The current implementation is scaffolded to support a Unix-style pipeline of small tools.

## Documentation

- [PRD](docs/click-track-builder-prd.md)
- [OpenSpec change](openspec/changes/init-click-track-builder/proposal.md)
