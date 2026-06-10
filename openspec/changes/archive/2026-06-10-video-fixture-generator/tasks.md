## 1. Fixture Generator Foundation

- [x] 1.1 Add deterministic video fixture generator module and CLI entrypoint for MP4 output.
- [x] 1.2 Implement declarative fixture config inputs (meter, BPM, frame rate, duration, leader length, preview toggle).
- [x] 1.3 Implement deterministic visual pulse rendering with explicit downbeat distinction.
- [x] 1.4 Lock encoding profile defaults (60 fps, fixed resolution, fixed pixel format, fixed codec settings).

## 2. Scenario Fixture Set

- [x] 2.1 Generate baseline fixture assets for 4/4 and 6/8 at 70, 80, and 120 BPM.
- [x] 2.2 Generate D = 0 scenario fixtures (equal leader lengths).
- [x] 2.3 Generate D > 0 scenario fixtures (video leader shorter than audio leader).
- [x] 2.4 Generate D < 0 scenario fixtures (video leader longer than audio leader).
- [x] 2.5 Add fixture metadata manifest capturing expected beat/downbeat timestamps and signed deltas.

## 3. Real Mux Validation Tests

- [x] 3.1 Add real BDD feature scenarios for D = 0, D > 0, and D < 0 mux validation.
- [x] 3.2 Add ffprobe-based step utilities to extract visual and audio timing from muxed outputs.
- [x] 3.3 Implement tolerance-bound assertions with diagnostic output (expected vs observed timestamps).
- [x] 3.4 Add optional preview artifact output path for human review in report directories.

## 4. Developer Workflow and Guardrails

- [x] 4.1 Add npm scripts to regenerate fixtures and run real mux sync validation.
- [x] 4.2 Document fixture regeneration and review workflow in README/OpenSpec notes.
- [x] 4.3 Ensure generated preview/report artifacts are ignored by git while canonical fixtures remain versioned.
- [x] 4.4 Validate full mock + real BDD lanes and update OpenSpec tasks/spec references.

## 5. Section Label Overlay

- [x] 5.1 Extend fixture generator input model to carry section windows and lead/click designation.
- [x] 5.2 Render persistent section name text overlay for active non-lead sections.
- [x] 5.3 Ensure lead/click sections intentionally render blank labels while keeping pulse visualization active.
- [x] 5.4 Add BDD/fixture assertions proving label transitions occur at section boundaries.
