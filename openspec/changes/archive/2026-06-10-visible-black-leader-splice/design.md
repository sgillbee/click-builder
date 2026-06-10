## Context

Leader-aware timestamp shifting fixed signed-delta math, but it still depends on player interpretation of delayed stream timestamps and does not guarantee a visible pause before the lyric video begins. The new approach needs to generate an actual black leader segment for positive-delay cases, splice it ahead of the original video body, and keep the original encoded body unchanged when concat compatibility allows it. Existing mock and real mux tests also need to move from asserting timestamp-only delay semantics to asserting visible-leader semantics where those scenarios model D > 0 behavior.

## Goals / Non-Goals

**Goals:**
- Generate a visible black leader segment for positive effective delta cases.
- Match source video encoding characteristics closely enough to allow splice/concat without re-encoding the original video body when possible.
- Keep D = 0 and D < 0 workflows on the simpler existing paths unless a visible leader is required.
- Refactor mock and real mux tests to validate the black-leader workflow where appropriate.
- Emit diagnostics that indicate when visible leader generation/splice is chosen.

**Non-Goals:**
- Re-encoding the full source video by default.
- Solving arbitrary codec/container incompatibilities beyond this project’s supported mux formats.
- Replacing leader-aware signed-delta math introduced in the prior change.

## Decisions

- Positive effective delta will select a black-leader splice path instead of timestamp-only delay.
  - Rationale: guarantees visible pause behavior in common players.
  - Alternative considered: continue using `-itsoffset` with stream copy only. Rejected because playback behavior is inconsistent across players.
- The leader segment will be encoded to match the source video stream as closely as practical, then concatenated with the original body.
  - Rationale: preserves original body compression while still creating actual video frames for the leader.
  - Alternative considered: re-encode the entire output video. Rejected as unnecessarily destructive for normal cases.
- Test refactors will split expectations by behavior class:
  - mock/unit tests assert branch selection, concat inputs, and preservation of original-body copy intent
  - real BDD tests assert visible black leader duration and continued sync correctness
- When concat compatibility fails, implementation may need a clearly logged fallback or fail-fast behavior; that decision should be explicit in code and tests.

## Risks / Trade-offs

- Concat compatibility may be fragile across arbitrary inputs -> Mitigation: probe source stream properties, constrain supported formats, and test known-good fixtures.
- Black leader generation may accidentally drift from source parameters -> Mitigation: diagnostics plus tests that inspect resulting stream metadata.
- Refactoring tests may temporarily invalidate old timestamp-only assumptions -> Mitigation: update mock and real assertions together in the same implementation slice.

## Migration Plan

- Update mux code path selection for D > 0.
- Add helper(s) for source stream probing, leader generation, and concat manifest creation.
- Refactor mock mux tests first, then real mux BDD tests.
- Keep D = 0 / D < 0 behavior covered to prevent regression.

## Open Questions

- Whether concat incompatibility should fail hard or fall back to a localized re-encode path.
- Whether audio should also receive a silent leader segment in any edge concat workflows, or remain on the current mux path after video splicing.
