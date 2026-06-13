## Context

Positive-delay muxing currently prepends a synthetic black leader ahead of the source body and relies on packet-level concat with `-c copy` to preserve the original video stream. That preserves quality when it works, but field testing has shown that matching codec name and nominal frame rate is not sufficient to guarantee timestamp-safe splicing across arbitrary user-supplied MP4s. When the splice is not actually compatible, the output can contain a silent timestamp discontinuity that shifts the visible downbeat later than the requested delay.

The product constraint is to preserve source video quality and source compression whenever possible. A blanket re-encode fixes continuity but degrades fidelity and can inflate file size. The design therefore needs a correctness-first lossless path, a deterministic failure mode when that path cannot be proven safe, and an explicit opt-in escape hatch for users who prefer guaranteed output generation over lossless preservation.

## Goals / Non-Goals

**Goals:**
- Preserve the original video body stream for positive-delay outputs only when prepend compatibility and timestamp continuity can be validated.
- Detect and reject unsafe lossless prepend attempts instead of silently producing shifted outputs.
- Provide an explicit CLI-controlled re-encode fallback for positive-delay outputs when the safe lossless path is unavailable.
- Strengthen diagnostics and real validation so splice-boundary discontinuities are observable in both tests and user logs.

**Non-Goals:**
- Rework the leader-aware delta math for D > 0, D = 0, or D < 0.
- Introduce re-encoding as the default positive-delay path.
- Add YAML-level configuration for mux fallback behavior.

## Decisions

### Decision: Keep lossless prepend as the default positive-delay policy
Positive-delay muxing will continue to prefer preserving the original body stream. This keeps the common case aligned with the product requirement to avoid unnecessary quality loss.

Alternatives considered:
- Always re-encode D > 0 outputs: simpler, but violates the quality and size goals for the default workflow.
- Keep the current copy-concat behavior unchanged: rejected because it can silently generate broken timestamps on real footage.

### Decision: Add explicit compatibility and continuity validation before accepting a lossless splice
The muxer will probe source and generated leader parameters more strictly than the current codec/fps check and will validate the resulting stitched video for monotonic timestamp continuity at the splice boundary. If validation fails, the lossless path is treated as unsafe.

Alternatives considered:
- Rely only on richer metadata matching without validating the stitched file: rejected because packet-level incompatibilities can still survive metadata checks.
- Validate only in tests: rejected because user-supplied footage can fail in ways fixture coverage does not predict.

### Decision: Fail by default, re-encode only under explicit user opt-in
When the safe lossless prepend path is unavailable, the default behavior will be a clear muxer error that explains the incompatibility. A new CLI flag will allow an explicit re-encode fallback for users who prefer successful output generation over strict lossless preservation.

Alternatives considered:
- Automatic re-encode fallback: rejected because it hides a meaningful quality trade-off.
- No fallback at all: rejected because some users will prefer a lower-fidelity output to a hard failure.

### Decision: Put the fallback control at the CLI boundary
The re-encode fallback will be enabled through a command-line option rather than a YAML config field. The fallback affects output strategy, not song structure semantics, and should remain a per-run operational choice.

## Risks / Trade-offs

- [Stricter validation may reject files that previously appeared to work] -> Document the failure mode clearly and provide the explicit re-encode override.
- [Continuity validation adds extra ffprobe/ffmpeg work] -> Keep the validation narrowly scoped to positive-delay outputs and splice-boundary checks.
- [Compatibility heuristics may still miss edge cases] -> Use stitched-output timestamp validation as the final acceptance gate rather than trusting metadata alone.
- [CLI flag increases operational surface area] -> Keep the option narrowly named and default it to off.

## Migration Plan

No data migration is required. Implementation should update CLI help text and user-facing diagnostics so positive-delay failures clearly explain the new fallback option. Rollback is straightforward: revert the muxer fallback-control changes and the associated tests.

## Open Questions

- Which exact ffmpeg/video properties must be matched before attempting the lossless prepend path, versus relying on stitched-output validation alone?
- Should the re-encode fallback preserve source resolution and nominal frame rate only, or also try to mirror source profile and bitrate targets?