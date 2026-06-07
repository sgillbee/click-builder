## ADDED Requirements

### Requirement: Mathematical Track Sequencing
The generator SHALL consume the AST JSON via `stdin` and output an array of absolute timestamps for each audio cue.

#### Scenario: No relative rounding drift
- **WHEN** calculating the 100th measure beat of a 139 BPM configuration
- **THEN** the output JSON contains an event where the time is correctly calculated from zero using absolute multiplication `(beat_index * 60000 / BPM)`, not relative summation.

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