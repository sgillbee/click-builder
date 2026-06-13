## MODIFIED Requirements

### Requirement: Real Mux Sync Validation for Signed Delta Cases
The real BDD suite MUST validate mux sync behavior for D = 0, D > 0, and D < 0 scenarios using generated deterministic fixtures.

#### Scenario: Real mux validation with D = 0
- **WHEN** the real BDD suite runs a zero-delta fixture
- **THEN** measured visual pulse timing and audible click alignment remain within configured tolerance with no net delay expectation.

#### Scenario: Real mux validation with D > 0
- **WHEN** the real BDD suite runs a positive-delta fixture
- **THEN** observed sync indicates validated video delay behavior, aligned beat/downbeat pulses within tolerance, and no splice-boundary timestamp discontinuity.

#### Scenario: Real mux validation with D < 0
- **WHEN** the real BDD suite runs a negative-delta fixture
- **THEN** observed sync indicates audio delay behavior and aligned beat/downbeat pulses within tolerance.

### Requirement: ffprobe-Based Machine Assertions
The real mux validation pipeline SHALL use ffprobe-derived timing data as the source of truth for automated assertions.

#### Scenario: Frame and audio timing extraction
- **WHEN** a muxed output fixture is analyzed
- **THEN** ffprobe extraction provides stream/frame/audio timing values that are compared against deterministic expected beat events.

#### Scenario: Splice-boundary continuity check
- **WHEN** a positive-delay muxed output is analyzed
- **THEN** ffprobe-derived frame timestamps confirm continuity across the leader-to-body boundary.