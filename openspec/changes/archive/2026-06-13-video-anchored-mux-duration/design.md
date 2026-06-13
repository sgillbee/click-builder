## Context

The final mux path currently combines a video stream and generated click audio with `-shortest`, which makes the shorter stream decide final output duration. That is acceptable only when audio and video are already the same length. In practice, lyric videos often contain ringout, logo animations, or other visual tail content after the click/cue program ends. The current policy truncates that tail whenever generated audio ends first.

The product intent is clearer than the current ffmpeg default: the original source video timeline should remain authoritative. If generated audio is shorter, the output should continue through the source video end in silence. If generated audio is longer, the output should still stop at the original video end, but the muxer should warn that audio content was truncated so the operator can evaluate whether the overrun indicates a benign mismatch or a real authoring bug.

## Goals / Non-Goals

**Goals:**
- Anchor final mux duration to the original source video duration.
- Preserve full source-video playback even when click audio ends early.
- Trim audio overruns to source-video duration and emit deterministic warnings that report the truncated amount.
- Validate end-of-program duration behavior in both unit and real mux tests.

**Non-GoaIs:**
- Rework leader-aware delta math or the positive-delay splice/fallback strategy.
- Change YAML song structure semantics or make duration anchoring configurable per song.
- Turn audio overrun into a hard failure by default.

## Decisions

### Decision: Make source video duration authoritative
The muxer will probe source video duration and use it as the target output duration for final assembly. This matches the user-facing expectation that the lyric video should always play to its normal end.

Alternatives considered:
- Continue to use `-shortest`: rejected because it silently drops valid source-video tail content.
- Let the longer stream decide output length: rejected because audio overruns would extend output past the intended video end.

### Decision: Normalize audio to the video duration boundary
If generated audio is shorter than the probed source video duration, the final mux path will pad the audio tail with silence. If generated audio is longer than video duration, the muxer will trim it to the video boundary.

Alternatives considered:
- Pad only short audio and leave long audio unchanged: rejected because it leaves output duration ambiguous.
- Hard-fail on audio overrun: rejected because some overruns are acceptable operationally and should remain warnings.

### Decision: Emit warnings only when audio content is discarded
Audio shorter than video is expected under the new policy and does not require a warning. Audio longer than video loses rendered click/cue content, so the muxer will log a warning with the truncation amount in seconds.

Alternatives considered:
- Warn on any duration mismatch: rejected because it would create noise for intentional silent tails.
- Surface truncation only in tests: rejected because operators need to see it during real runs.

### Decision: Validate duration anchoring with real media fixtures
The real mux suite will verify that outputs keep the full video duration when audio ends early and that overrun cases produce both correct output duration and the expected warning signal.

## Risks / Trade-offs

- [Duration probing can be container-dependent] -> Use ffprobe-derived source duration and keep tolerance-based assertions in tests.
- [Padding or trimming audio changes final mux argument complexity] -> Confine the policy to the final mux stage rather than changing timeline generation.
- [Warnings may be ignored in noisy logs] -> Include the truncation amount and make the message deterministic so it is easy to grep.
- [Real fixtures may not currently cover audio-overrun cases] -> Add or adapt fixtures to exercise both short-audio and long-audio end-of-program behavior.

## Migration Plan

No data migration is required. Existing songs should continue to work, but outputs will retain full source-video tails instead of truncating early. Rollback is straightforward: restore the current final mux duration policy and remove the new warning/test coverage.

## Open Questions

- Should the truncation warning remain stderr-only, or should it also be surfaced in machine-readable final JSON output?
- Is audio duration normalization best implemented directly in the final mux command, or via an intermediate padded/trimmed audio artifact for easier diagnostics?