# Click Builder

Build click-track videos from a YAML song definition and a source lyric video.

`click-builder` parses a project file, generates beat-accurate click and cue audio, then muxes that audio back into the source video with FFmpeg.

## What It Does

- Parse a YAML project file into a validated AST
- Generate a beat-accurate timeline from tempo, meter, and structure
- Render click and cue stems into a mixed WAV file
- Mux the generated audio back into the source video
- Support self-contained project files with input and output video paths in YAML

## Quick Start

### Prerequisites

You need:

- Node.js 20 or newer
- `ffmpeg` and `ffprobe` available on your `PATH`

### Install Node.js

If you do not already have Node.js installed, install the current LTS release.

#### Windows

```bash
winget install OpenJS.NodeJS.LTS
```

#### macOS

```bash
brew install node
```

#### Ubuntu / Debian

```bash
sudo apt update
sudo apt install nodejs npm
```

### Install FFmpeg

#### Windows

```bash
winget install Gyan.FFmpeg
```

#### macOS

```bash
brew install ffmpeg
```

#### Ubuntu / Debian

```bash
sudo apt update
sudo apt install ffmpeg
```

### Verify Your Install

```bash
node --version
npm --version
ffmpeg -version
ffprobe -version
```

If all four commands succeed, you are ready to run `click-builder`.

### Run Without Installing Globally

The easiest way to try it is with `npx`:

```bash
npx @popscode/click-builder ./project.yaml
```

If your YAML includes `input_video_path` and `output_video_path`, that is enough.

### Install Globally

If you use `click-builder` regularly, install it globally:

```bash
npm install -g @popscode/click-builder
```

Then run:

```bash
click-builder ./project.yaml
```

### Run From This Repository

If you are using the source checkout directly:

```bash
npm install
npm run build
npm install -g .
click-builder ./project.yaml
```

## Example Project File

The recommended format is a self-contained YAML project file with video paths and explicit stems.

```yaml
name: "My Song"
tempo: 137
time_signature: 4/4
video_downbeat_offset_ms: 400
click_profile: assets/click-profiles/PraiseCharts.config.yml

input_video_path: ./My Song - Lyric Video - Instrumental.mp4
output_video_path: ./My Song - Lyric Video - Click.mp4

count_in_enabled: true
section_markers_enabled: true
downbeat_emphasis_enabled: true
mid_beat_filler_enabled: false

stems:
  - id: instrumental_full
    source:
      type: source-video-audio
    routing:
      left_percent: 100
      right_percent: 100

  - id: click
    source:
      type: generated
      generated_stem: click
    routing:
      left_percent: 100
      right_percent: 100

  - id: cue
    source:
      type: generated
      generated_stem: cue
    routing:
      left_percent: 100
      right_percent: 100

structure:
  - section: "Click"
    measures: 2
  - section: "Intro"
    measures: 2
  - section: "Verse 1"
    measures: 8
  - section: "Chorus"
    measures: 8
  - section: "Outro"
    measures: 4
```

## CLI Usage

```bash
click-builder [--allow-reencode] <config.yaml> [input-video] [output-video]
```

Path precedence is:

1. CLI arguments
2. YAML `input_video_path` and `output_video_path`
3. error if neither provides the required path

In most cases, the recommended approach is to keep paths in the YAML so the project file is self-contained.

## Troubleshooting

### `ffmpeg` not found

Install FFmpeg and make sure `ffmpeg` is on your `PATH`.

### `ffprobe` not found

Install FFmpeg and make sure `ffprobe` is on your `PATH`.

### Node version too old

Upgrade to Node.js 20 or newer.

### Command not found after global install

Make sure npm global binaries are on your shell `PATH`, or run with `npx` instead.

## Optional: Use fnm

If you prefer a Node version manager, `fnm` is a good lightweight option.

### Windows

```bash
winget install Schniz.fnm
fnm install --lts
fnm use lts-latest
```

### macOS

```bash
brew install fnm
fnm install --lts
fnm use lts-latest
```

Then verify:

```bash
node --version
npm --version
```

## Development

Install dependencies:

```bash
npm install
```

Build:

```bash
npm run build
```

Run the main test suites:

```bash
npm run test
npm run test:coverage
npm run test:bdd
```

Generate deterministic real-mux fixtures:

```bash
npm run fixtures:video-sync
```

Unit tests live next to the source they exercise as `*.test.ts` files.

BDD tests live under `tests/bdd/` as `.feature` files with matching step definitions.

## Project Structure

- `docs/` - product and planning documentation
- `openspec/` - proposal, design, specs, and archived changes
- `src/` - CLI pipeline source code
- `assets/` - click profiles and runtime assets
- `tests/` - BDD coverage and fixtures

## Notes

- Internal timing values are stored as floating-point millisecond values.
- The generated click stem is the timing foundation for leader-aware muxing.
- Existing YAML files without `stems` still work, but new project files should prefer the explicit stem-routing format.

## Documentation

- [PRD](docs/click-track-builder-prd.md)
- [Release Process](docs/release.md)
