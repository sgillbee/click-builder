## Why

The current mux alignment applies only the raw video downbeat offset and does not account for click-leader duration, which causes incorrect sync behavior across D > 0, D = 0, and D < 0 scenarios. This is blocking real song workflows where the click intro effectively acts as negative leader relative to the source video downbeat.

## What Changes

- Compute effective signed delta from timeline-derived click leader and configured video downbeat offset.
- Update mux behavior to delay video for positive effective delta and delay audio for negative effective delta.
- Add deterministic diagnostics that expose leader math inputs and final applied delta.
- Add and expand tests to validate all three signed-delta cases with leader-aware alignment.

## Capabilities

### New Capabilities

- `leader-aware-mux-alignment`: Defines how effective signed delta is calculated from click leader and video downbeat offset, and how mux applies stream delay accordingly.

### Modified Capabilities

- `video-muxer`: Change requirement from raw offset application to leader-aware signed delta behavior with explicit diagnostics.
- `timeline-generator`: Clarify and enforce derivation of click leader timing inputs used by mux alignment logic.

## Impact

- Affected code:
  - src/pipeline.ts
  - src/muxer/muxer.ts
  - src/timeline/generator.ts
  - tests/bdd/video-muxing/*
  - src/muxer/*.test.ts
- User-visible behavior: muxed outputs now align by effective leader delta, not raw offset alone.
- Diagnostics: stderr logging will include leader math inputs and resolved signed delta.
