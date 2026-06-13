## Why

Positive-delay outputs currently rely on a synthetic black-leader splice path that assumes the generated leader segment and copied source body are packet-compatible for concat. Real user footage has shown that this assumption can produce timestamp discontinuities at the splice boundary, which silently pushes visible downbeats later than the requested delay.

## What Changes

- Tighten the positive-delay mux workflow so lossless body preservation is only used when prepend compatibility can be proven and the stitched output passes continuity validation.
- Fail the build with a clear muxer error when a positive-delay prepend cannot be completed safely under lossless-preservation rules.
- Add an explicit CLI option that allows positive-delay outputs to fall back to a re-encoded stitch when the safe lossless prepend path is not available.
- Extend diagnostics and real mux validation so timestamp discontinuities at the leader/body boundary are detected automatically.

## Capabilities

### New Capabilities
- `muxer-reencode-fallback-control`: Controls whether positive-delay muxing may fall back to a re-encoded stitch when safe lossless prepend validation fails.

### Modified Capabilities
- `video-muxer`: Positive-delay prepend must validate compatibility and timestamp continuity before preserving the original body stream.
- `real-mux-sync-validation`: Real mux validation must detect splice-boundary timestamp discontinuities for positive-delay outputs.

## Impact

- Affected code: `src/muxer/muxer.ts`, `src/muxer/contracts.ts`, `src/pipeline.ts`, `src/cli.ts`, and related tests.
- Affected tests: muxer unit tests plus real BDD mux validation.
- User-facing API: adds a CLI flag to opt into re-encode fallback for positive-delay outputs.