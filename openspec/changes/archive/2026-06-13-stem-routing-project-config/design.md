## Context

The current pipeline already handles modular parsing, timeline generation, audio rendering, and muxing, but routes generated stems into a mostly fixed stereo outcome and requires input/output video paths via CLI positional args. The next increment must preserve the existing pipeline boundaries while adding explicit stem-based routing and project-style path configuration.

Key constraints:

- Routing semantics must remain playback-system agnostic.
- Existing configs without `stems` must continue to work.
- Diagnostics remain on stderr and machine-readable payloads remain on stdout.
- Data contracts across parser, timeline, renderer, and muxer must stay explicit.

## Goals / Non-Goals

**Goals:**

- Add a declarative `stems` YAML section with source and L/R routing metadata.
- Support initial stem sources: generated click, generated cue, source-video full mixed audio.
- Use integer routing percentages `0-100` with default `left=100`, `right=100` when unspecified.
- Allow valid silent output when no stems are routed.
- Fail loudly when a declared stem source cannot be resolved.
- Preserve deterministic stem ordering based on YAML declaration order.
- Add project-style YAML path support and enforce precedence `CLI > YAML > error`.
- Maintain backward compatibility for legacy configs.

**Non-Goals:**

- Modeling venue/hardware roles (for example stage/ears/room semantics).
- Implementing isolated instrument stem ingestion in this change.
- Building DAW-like mixing features (automation curves, EQ, compression graphs, and similar).

## Decisions

1. Canonical routing model is per-stem left/right percentages (0-100)

- Decision: Define routing using integer percentages `left` and `right` only.
- Rationale: Human-friendly values and straightforward validation.
- Alternative considered: floating-point weights `0.0-1.0`.
- Why not chosen: less intuitive for users and unnecessary precision for this stage.

2. Routing defaults are permissive and backward-compatible

- Decision: If routing is omitted for a stem, apply `left=100`, `right=100`.
- Rationale: Preserves existing stereo behavior for legacy configs.
- Alternative considered: strict explicit routing required.
- Why not chosen: would break existing workflows and increase friction.

3. Silence is a valid output state

- Decision: Empty routing result is legal and produces silence.
- Rationale: User intent can include intentionally silent render paths.
- Alternative considered: require at least one routed stem.
- Why not chosen: conflicts with agreed behavior and adds unnecessary policy.

4. Source resolution errors are hard failures

- Decision: Missing/unresolvable source for any declared stem fails the run.
- Rationale: Prevents silent corruption and makes failures diagnosable.
- Alternative considered: best-effort skip missing stems.
- Why not chosen: can mask broken configs.

5. Deterministic mixing follows YAML stem order

- Decision: Preserve declared stem order through normalization and rendering.
- Rationale: deterministic output and stable regression tests.
- Alternative considered: internal sorting by stem id/source type.
- Why not chosen: would decouple behavior from authored config intent.

6. Path precedence contract is explicit and centralized

- Decision: Resolve input/output video paths with precedence `CLI > YAML > error`.
- Rationale: supports both script overrides and self-contained project files.
- Alternative considered: YAML-only or CLI-only ownership.
- Why not chosen: both reduce flexibility for automation and local project runs.

7. Contract propagation strategy uses normalized parser output

- Decision: Parser normalizes stems and project I/O fields into canonical AST/timeline contracts; renderer/muxer consume canonical fields.
- Rationale: keeps validation and compatibility logic in one place.
- Alternative considered: ad hoc defaults inside renderer and CLI separately.
- Why not chosen: duplicated logic and drift risk.

## Risks / Trade-offs

- [Risk] Expanded schema complexity could increase parsing edge cases.
  -> Mitigation: strict schema validation plus targeted unit tests for defaults and invalid inputs.

- [Risk] Video-audio-as-stem source extraction may add ffmpeg workflow complexity.
  -> Mitigation: keep initial source model minimal and isolate extraction logic behind explicit source type handling.

- [Risk] Backward compatibility paths can hide migration mistakes.
  -> Mitigation: add migration docs and test both legacy and explicit stem configs.

- [Risk] Silent output being valid can confuse users when accidental.
  -> Mitigation: emit informative stderr diagnostics summarizing routed stem count and resulting mix state.

## Migration Plan

1. Add contract/schema extensions for stems and optional project paths.
2. Add parser normalization with backward-compatible defaults.
3. Extend timeline payload as needed for renderer/muxer consumption.
4. Implement renderer routing application (0-100 percentages, default behavior, deterministic order).
5. Implement source resolution handling for generated stems and source-video-audio stem with loud failure paths.
6. Implement CLI/pipeline path resolution precedence (`CLI > YAML > error`).
7. Add and run unit tests for contracts, parser normalization, routing math/order, and precedence.
8. Add and run integration/BDD scenarios for required routing and failure behaviors.
9. Publish migration notes and YAML examples.

Migration approach for existing YAML files:

- Existing YAML files remain valid as-is because `stems` is additive and routing defaults preserve current stereo behavior.
- No mandatory conversion step is required for legacy configs.
- Provide documented examples showing how to opt into the new `stems` and project path fields.
- If a future breaking cleanup is needed, introduce it as an explicit migration utility or schema version bump rather than silently changing legacy behavior.
- Existing BDD coverage for legacy YAML configs SHOULD remain green unchanged after this change.
- New BDD coverage SHOULD be added for the new YAML stem-routing and project-style path format, rather than replacing legacy scenarios.
- New @real BDD scenarios SHOULD reuse the existing golden reference files as the regression baseline, so the new format is validated against the same canonical artifacts.

Rollback strategy:

- Keep changes behind schema-compatible defaults so existing config behavior remains available.
- If regressions occur, revert to prior contract version and disable new `stems` parsing path.

## Open Questions

- None. The following decisions have been made:
  - Emit a concise route matrix summary by default.
  - Defer source index override for source-video-audio extraction to future scope.
  - Defer explicit gain controls until routing lands stably.
