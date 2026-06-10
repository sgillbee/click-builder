## Context

The project already validates click/audio generation with real golden WAV comparisons and validates mux math in mocked BDD scenarios. What is missing is deterministic, real video sync validation where visible beat events can be compared to audible click timing across D = 0, D > 0, and D < 0 alignment paths. Existing ad-hoc videos or AI-generated videos are not suitable because they are not frame-accurate and not reproducible enough for reliable CI test behavior.

The team requested a practical test foundation that supports variable leader lengths, meters (4/4 and 6/8), and BPM sets (70, 80, 120) while allowing both machine assertions and optional human preview review.

## Goals / Non-Goals

**Goals:**
- Provide deterministic MP4 fixture generation with fixed encoding parameters and timing semantics.
- Encode visual beat/downbeat signals that are easy to assert with ffprobe and easy to review by eye.
- Support fixture scenarios for D = 0, D > 0, and D < 0 by varying leader lengths.
- Add real BDD mux tests that assert sync behavior using generated fixtures and measurable tolerances.
- Produce optional preview artifacts for manual review without making them required for pass/fail.

**Non-Goals:**
- Photorealistic or AI-generated source videos.
- Support for every media format in the first iteration (MP4 only initially).
- Bit-identical whole-file MP4 golden hashing across environments.

## Decisions

1. Deterministic synthetic fixtures over AI-generated videos.
- Rationale: AI video generation is not frame deterministic and can drift in timing/visual content.
- Alternative considered: Human-created fixture videos checked into repo only. Rejected because regeneration and coverage expansion become manual and brittle.

2. Visual timing signal uses frame pulses with downbeat distinction.
- Rationale: A one-frame full-screen pulse (with distinct downbeat style) is robust for machine and human validation.
- Alternative considered: Text overlays for beat numbers. Rejected as primary method due to font/render variability and parsing complexity.

3. Section context uses persistent text overlays driven by timeline sections.
- Rationale: Human reviewers need persistent context for "where we are in the song" while validating beat/cue sync.
- Behavior: The active section name is shown continuously during that section; designated lead/click sections may render no label.
- Alternative considered: Section-only color coding. Rejected because many similar colors become ambiguous in longer songs.

4. Fixed baseline encoding profile.
- Choice: 60 fps default, fixed resolution, fixed pixel format, fixed codec/profile settings.
- Rationale: Better temporal precision for sync checks and reproducible frame indexing.

5. Behavioral assertions over full MP4 hash equality.
- Rationale: Container-level metadata and encoding nondeterminism can vary by ffmpeg build even when timing is correct.
- Approach: assert stream mapping and timestamp alignment windows via ffprobe and deterministic expected cue frames.

6. Separate machine assertions from optional human preview artifacts.
- Rationale: CI should rely on objective checks; preview outputs aid review/debug without creating flaky gate criteria.

## Risks / Trade-offs

- [Risk] FFmpeg version differences may slightly alter timestamp rounding.
  - Mitigation: Use explicit tolerance windows and pinned ffprobe extraction logic.

- [Risk] Fixture generation could increase real-lane test runtime.
  - Mitigation: Keep fixtures short, generate only needed scenarios, cache outputs when unchanged.

- [Risk] Overly strict assertions can create false negatives.
  - Mitigation: Define bounded tolerance and assert relative alignment semantics rather than raw byte identity.

- [Risk] Text rendering differences across environments can reduce reproducibility.
  - Mitigation: Use pinned ffmpeg text-render settings and deterministic placement; treat text as review aid while timing assertions remain ffprobe-based.

- [Risk] Optional preview artifacts may clutter workspace.
  - Mitigation: Emit previews under report paths and ignore them in git.
