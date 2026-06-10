# timeline-generator Specification

## Purpose
TBD - created by archiving change init-click-track-builder. Update Purpose after archive.
## Requirements
### Requirement: Mathematical Track Sequencing
The generator SHALL consume AST JSON and produce absolute event timestamps that can be used to derive click leader timing for mux alignment.

#### Scenario: No relative rounding drift
- **WHEN** calculating late-song beat timestamps for high-measure arrangements
- **THEN** output event times are computed from absolute math and remain stable without cumulative drift.

#### Scenario: First click timestamp is derivable from output events
- **WHEN** a generated timeline contains click events
- **THEN** the first click event timestamp can be deterministically read as the click leader timing input used by mux alignment.

### Requirement: Pipeline validation
The generator SHALL gracefully fail if passed a malformed AST schema from the parser.

#### Scenario: Invalid upstream data
- **WHEN** the `timeline-generator` receives JSON missing the `structure` object
- **THEN** it emits a detailed error to `stderr` and exits with code `1`.

### Requirement: Foundation vs. Overlaid Mix Multi-tracking
The generator SHALL mathematically treat the metronome click as a continuous foundational layer, and all cues (voice, sections, counts) as explicit independent stems to be overlaid or mixed on exact timestamps.

#### Scenario: Stem layer mapping
- **WHEN** building a 120BPM timeline with a "Verse One" cue triggering on measure 17
- **THEN** the generator outputs a JSON structure defining independent stem timelines (e.g., `stem_click`, `stem_cues`) placing the cue at the exact same millisecond timestamp as the corresponding foundation metronome click.

