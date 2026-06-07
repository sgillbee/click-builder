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
- A project YAML config file

## Install

```bash
npm install
```

## Scripts

```bash
npm run test
npm run test:bdd
```

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
video_downbeat_offset: 4230
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
