## Why

Real video mux validation currently depends on mocked argument checks and does not provide deterministic visual sync proof for D = 0, D > 0, and D < 0 alignment paths. We need reproducible, machine-generated video fixtures and real BDD assertions that verify audible click alignment against visible beat signals.

## What Changes

- Add a deterministic video fixture generator that produces short MP4 fixtures with frame-accurate visual beat/downbeat markers.
- Add generated fixture sets for 4/4 and 6/8 timing contexts at 70, 80, and 120 BPM, including configurable leader lengths.
- Add section label overlays so the active song section name remains visible during its section window.
- Add real BDD mux scenarios that validate D = 0, D > 0, and D < 0 alignment behavior against generated fixtures.
- Add ffprobe-based verification utilities and optional human-review preview artifacts for debugging and acceptance review.
- Add regeneration workflow and guardrails so fixture updates are intentional and reproducible.

## Capabilities

### New Capabilities
- `video-sync-fixture-generator`: Deterministic generation of timing-encoded MP4 fixtures with configurable meter, BPM, duration, frame rate, and leader length.
- `real-mux-sync-validation`: Real BDD verification of mux sync alignment using generated fixtures, ffprobe timing checks, and optional preview artifacts.

### Modified Capabilities
- None.

## Impact

- Affected code: test fixture tooling (new script/module), BDD real tests for muxing, and reporting artifacts.
- Affected dependencies: ffmpeg/ffprobe runtime usage in real test workflows.
- Affected assets: generated MP4 fixtures under `tests/fixtures/video-sync/` and optional review outputs under reports.
- Affected test runtime: additional real-lane execution time for fixture generation/verification, with deterministic output constraints.
