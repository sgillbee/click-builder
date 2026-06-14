# PRD to BDD Traceability

This document maps PRD expectations to feature workflows.

## Core Pipeline
- Parse YAML config -> `tests/bdd/click-builder/click-builder.feature`
- Generate timeline -> `tests/bdd/timing-and-meter/timing-and-meter.feature`
- Render click/cue stems -> `tests/bdd/audio-mixdown/audio-mixdown.feature`
- Mux into video with offset -> `tests/bdd/video-muxing/video-muxing.feature`

## Musical Behavior
- Mid-song meter shifts -> `tests/bdd/timing-and-meter/timing-and-meter.feature`
- Generic click divisions across meters -> `tests/bdd/timing-and-meter/timing-and-meter.feature`
- Count-in and section cues -> `tests/bdd/cues-and-markers/cues-and-markers.feature`

## Media / Formats
- Input video/audio format handling -> `tests/bdd/formats-and-compatibility/formats-and-compatibility.feature`
- Output codec/container handling -> `tests/bdd/formats-and-compatibility/formats-and-compatibility.feature`
- No video re-encode -> `tests/bdd/video-muxing/video-muxing.feature`

## Operational Constraints
- Error handling and diagnostics -> `tests/bdd/error-handling/error-handling.feature`
- Split-track stem routing (future-facing requirement) -> `tests/bdd/routing-and-stems/routing-and-stems.feature`

## Execution Policy
- `@pending` scenarios represent accepted PRD workflows not implemented in code yet.
- CI executes non-pending scenarios by default.
