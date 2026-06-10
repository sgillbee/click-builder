## Why

Timestamp-only video delay preserves stream copy but does not reliably produce a visible pause in common players, which makes click intros appear truncated even when mux timings are technically correct. The workflow needs a true visible blank leader segment so operators see black before the lyric video starts while preserving the original encoded video body where possible.

## What Changes

- Add a visible black-leader splice workflow for positive video delay cases.
- Generate a synthetic black leader segment that matches source video characteristics closely enough for concat/splice.
- Preserve the original video body without re-encoding when concat compatibility allows it.
- Add diagnostics and real mux validation proving the visible leader is present and sync remains correct.

## Capabilities

### New Capabilities
- `visible-video-leader-splice`: Covers generation of a visible blank leader segment, concat/splice rules, and validation of the resulting muxed output.

### Modified Capabilities
- `video-muxer`: Change positive-delay behavior from timestamp-only offset to visible leader splice behavior while preserving existing negative/zero cases.

## Impact

- Affected code:
  - src/muxer/*
  - src/pipeline.ts
  - tests/bdd/video-muxing/*
  - fixture/test helpers for real mux validation
- FFmpeg workflow impact: adds leader-segment generation and concat/splice path for D > 0 outputs.
- User-visible behavior: muxed videos show an actual visible black pause before the original lyric video begins.
