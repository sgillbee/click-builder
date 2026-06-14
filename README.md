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

## YAML Configuration Reference

This section documents every supported YAML attribute and how it behaves.

### Top-Level Fields

| Field | Type | Required | Default | Notes |
| --- | --- | --- | --- | --- |
| `name` | `string` | yes | none | Project name for metadata/logging. |
| `tempo` | `number` | yes | none | Base BPM used by sections unless overridden per section. |
| `time_signature` | `string` (`X/Y`) | yes | none | Base meter used by sections unless overridden per section. |
| `video_downbeat_offset_ms` | `number >= 0` | yes | none | Downbeat offset in milliseconds. |
| `click_profile` | `string` path | no | `assets/click-profiles/PraiseCharts.config.yml` | Click/cue asset mapping profile. |
| `input_video_path` | `string` path | no** | none | Source video path; can be provided via CLI arg instead. |
| `output_video_path` | `string` path | no** | none | Output video path; can be provided via CLI arg instead. |
| `count_in_enabled` | `boolean` | no | `true` | Base default for section count-in behavior. |
| `divisions` | positive integer | no | none | Pulses per measure override; applies to any time signature. |
| `section_markers_enabled` | `boolean` | no | `true` | Base default for section cue announcements. |
| `downbeat_emphasis_enabled` | `boolean` | no | `true` | Emits `click.downbeat` on beat/pulse 1 when enabled. |
| `mid_beat_filler_enabled` | `boolean` | no | `false` | Inserts `click.between` halfway between pulses. |
| `stems` | `array` | no | none | Stem routing configuration (see Stem Fields). |
| `structure` | `array<section>` | yes | none | Ordered song/click sections (see Section Fields). |

\** Runtime requires paths from either CLI args or YAML fields.

### Stem Fields (`stems[]`)

Each stem entry supports:

| Field | Type | Required | Default | Notes |
| --- | --- | --- | --- | --- |
| `id` | `string` | yes | none | Identifier for your project organization. |
| `source.type` | `generated \| source-video-audio` | yes | none | Stem source selector. |
| `source.generated_stem` | `click \| cue` | when `source.type=generated` | none | Selects generated stem type. |
| `routing.left_percent` | `0..100` integer | no | `100` | Left channel gain percent. |
| `routing.right_percent` | `0..100` integer | no | `100` | Right channel gain percent. |

Notes:

- Routing is currently applied to generated stems (`click`, `cue`).
- `source-video-audio` is accepted by schema and parser for forward compatibility, but generated mix behavior currently centers on generated stems.

### Section Fields (`structure[]`)

Each `structure` entry supports:

| Field | Type | Required | Default | Notes |
| --- | --- | --- | --- | --- |
| `section` | `string` | yes | none | Section name used for cue lookup normalization. |
| `measures` | positive integer | yes | none | Number of measures in this section. |
| `final_measure_beats` | positive integer | no | full measure | Limits click count in the final measure (clamped to meter top). |
| `time_signature` | `string` (`X/Y`) | no | inherited from top-level `time_signature` | Per-section meter override. |
| `tempo` | `number` | no | inherited from top-level `tempo` | Per-section BPM override. |
| `section_designator` | `song \| click` | no | auto (`click` if section normalizes to `click`, else `song`) | Affects some cue behaviors. |
| `count_in_enabled` | `boolean` | no | inherited from top-level `count_in_enabled` (`true`) | Enables intro lead-in cue counts behavior. |
| `divisions` | positive integer | no | inherited from top-level `divisions` | Per-section pulse override for any meter. |
| `section_markers_enabled` | `boolean` | no | inherited, except auto-`false` for `section_designator=click` | Emits `cue.section:<name>`. |
| `downbeat_emphasis_enabled` | `boolean` | no | inherited from top-level (`true`) | Downbeat vs upbeat click behavior. |
| `mid_beat_filler_enabled` | `boolean` | no | inherited from top-level (`false`) | Inserts midpoint clicks in each pulse interval. |
| `count_cues_enabled` | `boolean` | no | `false` | Emits `cue.count:2..N` during first measure. |
| `section_cue_override` | `string` | no | none | Replaces section name used for cue asset lookup. |

### Inheritance and Override Rules

- Top-level `tempo` and `time_signature` define the base.
- Section-level `tempo` and `time_signature` override only that section.
- Boolean behavior flags inherit from top-level defaults unless overridden on the section.
- `section_designator` defaults to:
  - `click` when normalized section name is `click`
  - `song` for all other section names

### Section Name Normalization for Cue Lookup

Section cue keys are normalized before lookup:

- Lowercased
- Non-alphanumeric characters replaced with `_`

Examples:

- `Verse 1` -> `verse_1`
- `Post-Chorus` -> `post_chorus`
- `Refrain 2` -> `refrain_2`

The renderer then resolves `cue.section:<normalized_name>` through the click profile mapping.

### Timing and Pulse Details

- Beat duration is calculated from BPM and denominator:
  - quarter note duration: `60000 / bpm`
  - beat duration: `quarter_note_duration * (4 / denominator)`
- Pulses per measure:
  - default: numerator (`X` in `X/Y`)
  - if `divisions` is set globally or on a section: that integer value is used
  - examples:
    - `4/4` with `divisions: 2` -> two clicks at beats 1 and 3
    - `6/8` with `divisions: 2` -> two clicks at beats 1 and 4
    - `12/8` with `divisions: 4` -> four clicks at beats 1, 4, 7, and 10
- `final_measure_beats` applies only to the last measure in a section:
  - clamped between `1` and full beats-per-measure
  - pulse count scales proportionally and is rounded to at least `1`

### Cue Emission Behavior

- Section markers (`cue.section:*`):
  - emitted when `section_markers_enabled` is `true`
  - timing is one measure before the section downbeat when possible
  - first section cue is emitted at timeline start
- Auto intro count cues:
  - apply when section is intro-like (`intro`, `intro_1`, etc.), `count_in_enabled=true`, and section is not designator `click`
  - for non-first intro sections, count cues are emitted during the preceding measure
  - for first intro section, count cues can emit on the first measure pulses
- Explicit count cues (`count_cues_enabled=true`):
  - emits `cue.count:2..N` on the first measure of the section

### Path Resolution and CLI Precedence

Input/output video paths are resolved in this precedence order:

1. CLI args: `click-builder <config> [input-video] [output-video]`
2. YAML: `input_video_path` and `output_video_path`
3. error if unresolved

### Advanced Example (Section Overrides)

```yaml
name: "Advanced Song"
tempo: 120
time_signature: 4/4
video_downbeat_offset_ms: 250

count_in_enabled: true
section_markers_enabled: true
divisions: 2

structure:
  - section: "Click"
    measures: 2
    section_designator: click
    section_markers_enabled: false

  - section: "Intro"
    measures: 2
    time_signature: 6/8
    divisions: 2

  - section: "Verse 1"
    measures: 8
    tempo: 124

  - section: "Tag"
    measures: 2
    final_measure_beats: 2
    section_cue_override: "Tag"
    count_cues_enabled: true
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
