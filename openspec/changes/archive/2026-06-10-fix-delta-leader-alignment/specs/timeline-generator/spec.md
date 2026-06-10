## MODIFIED Requirements

### Requirement: Mathematical Track Sequencing
The generator SHALL consume AST JSON and produce absolute event timestamps that can be used to derive click leader timing for mux alignment.

#### Scenario: No relative rounding drift
- **WHEN** calculating late-song beat timestamps for high-measure arrangements
- **THEN** output event times are computed from absolute math and remain stable without cumulative drift.

#### Scenario: First click timestamp is derivable from output events
- **WHEN** a generated timeline contains click events
- **THEN** the first click event timestamp can be deterministically read as the click leader timing input used by mux alignment.
