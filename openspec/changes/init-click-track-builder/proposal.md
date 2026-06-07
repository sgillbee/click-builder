## Why

We are building a toolset to convert existing lyric videos into click-track videos for live band accompaniment. To avoid complex, brittle monoliths, we are implementing this as a suite of highly composable, Unix-style CLI micro-tools that can easily be tested, swapped, and integrated into future workflows (like web UIs or automated pipelines).

## What Changes

- Create a suite of distinct CLI tools that pass JSON/text payloads via standard input/output (`stdin`/`stdout`).
- **Phase 1 (Config Parser):** Parse a YAML configuration (tempo, structure, manual video downbeat timecode) and validate it.
- **Phase 2 (Timeline Generator):** Perform math to assign absolute millisecond timestamps to every click/cue, preventing drift over long songs.
- **Phase 3 (Audio Renderer):** Generate the actual click track audio from Ableton fragments based on the calculated timeline. Support normalization/limiting to a target dB level (e.g., `-3dB`) to avoid clipping when mixing the foundation click and overlaid cue stems. Output format is flexible, favoring standard envelopes (e.g. AAC/MP3) designed for multiplexing into the video.
- **Phase 4 (Video Muxer):** Combine the generated audio with the original video, using `-itsoffset` (calculated via the manual downbeat config) to perfectly sync the count-in to the music without re-encoding the video frame data.

## Capabilities

### New Capabilities
- `data-contracts`: Defines the explicit schema boundaries (YAML, AST JSON, Timeline JSON) enforcing inter-tool compatibility over standard streams.
- `config-parser`: Parse and validate YAML config (including manual downbeat timecode and mid-song meter shifts), outputting a structured AST JSON.
- `timeline-generator`: Consume AST JSON, calculate absolute millisecond placements for all audio events, outputting Timeline JSON.
- `audio-renderer`: Consume Timeline JSON, sequence WAV fragments, and output the mixed track (audio file).
- `video-muxer`: Calculate the required `-itsoffset` based on downbeat timecode, merge the generated click track with the original video losslessly.

### Modified Capabilities

## Impact

- Architecture allows Polyglot development (e.g., TS for parsing/orchestration, Python if needed for heavy media processing), though we will start with best-fit tools for each phase.
- Requires BDD tests that validate end-to-end piping behaviors via standard CLI mechanisms.
- Requires FFmpeg executable on the host.