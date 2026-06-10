## Context

Current mux behavior derives stream delay directly from configured video downbeat offset and does not include click leader duration derived from generated timeline events. This creates incorrect alignment in real workflows where click-intro length is longer than video leader, and makes D-sign scenarios appear wrong despite valid source media. The fix must be deterministic, cross-platform safe for long arrangements, and observable through stderr diagnostics.

## Goals / Non-Goals

**Goals:**
- Compute effective signed delta using leader-aware math before muxing.
- Use a single source of truth for leader timing that is derived from timeline events.
- Apply delay to video for D > 0, audio for D < 0, and no net delay for D = 0.
- Emit diagnostics that show key inputs and final applied delta.
- Add regression tests for D > 0, D = 0, and D < 0 with explicit leader math checks.

**Non-Goals:**
- Replacing FFmpeg mux implementation or codecs.
- Automatic detection of video downbeat from media content.
- Major changes to YAML structure beyond the existing offset key transition.

## Decisions

- Derive click leader duration from first click event timestamp in generated timeline.
  - Rationale: timeline is already deterministic and reflects section/meter/count-in behavior.
  - Alternative considered: derive leader from AST sections only. Rejected because it duplicates timeline logic and risks drift.
- Compute effective signed delta as `timeline.video_downbeat_offset_ms - first_click_timestamp_ms`.
  - Rationale: represents video leader minus click leader in one scalar.
  - Alternative considered: `first_click - video` with inverted D semantics. Rejected to preserve existing D sign conventions in tests and docs.
- Keep mux API centered on signed delta and continue mapping positive to delayed video and negative to delayed audio.
  - Rationale: minimal change to FFmpeg branch structure and existing test model.
- Add structured stderr diagnostics at pipeline/mux boundary.
  - Rationale: fast triage for unit/field issues without requiring ffprobe every run.

## Risks / Trade-offs

- Incorrect leader extraction for edge timelines (no click events) -> Mitigation: fail fast with explicit error and test coverage.
- Behavior shift for existing users who tuned around legacy raw-offset bug -> Mitigation: document change and preserve deterministic logs showing resolved delta.
- Additional pipeline coupling between timeline and mux input contracts -> Mitigation: codify contract fields and add unit + BDD assertions.
