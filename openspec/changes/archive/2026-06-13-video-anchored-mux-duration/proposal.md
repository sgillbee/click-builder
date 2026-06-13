## Why

The muxer currently lets the shorter stream decide final output duration, which truncates lyric videos when generated click audio ends before the original video ringout or closing animation. That behavior loses source video content and makes short click tracks unsafe for production use.

## What Changes

- Anchor final mux duration to the original source video instead of the shorter of video and generated audio.
- Pad generated audio with silence when it ends before the source video reaches its natural end.
- Trim generated audio when it exceeds source video duration and emit a deterministic warning that reports the amount of truncated audio.
- Extend real mux validation so end-of-program duration and truncation-warning behavior are verified.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `video-muxer`: Final output duration must be anchored to source video length, with silence padding for short audio and warnings when long audio is truncated.
- `real-mux-sync-validation`: Real mux tests must validate full-video retention and truncation-warning behavior around end-of-program duration mismatches.

## Impact

- Affected code: `src/muxer/muxer.ts`, `src/muxer/contracts.ts`, and any CLI or diagnostics surface that reports mux warnings.
- Affected tests: muxer unit tests and real mux BDD coverage.
- User-facing behavior: lyric videos keep their original tail even when generated click audio ends earlier; audio overruns produce a visible warning.