## ADDED Requirements

### Requirement: Deterministic MP4 Fixture Generation
The system SHALL generate deterministic MP4 test fixtures from declarative timing parameters, including meter, tempo, duration, frame rate, and leader length.

#### Scenario: Generate 4/4 fixture at 80 BPM with two-beat leader
- **WHEN** the fixture generator is invoked for 4/4 at 80 BPM with a configured leader
- **THEN** it emits an MP4 fixture whose visual beat pulses occur at deterministic frame timestamps matching the configured beat grid.

#### Scenario: Generate 6/8 fixture at 70 BPM with configurable leader
- **WHEN** the fixture generator is invoked for 6/8 at 70 BPM with a configured leader
- **THEN** it emits an MP4 fixture with deterministic pulse timing for six beats per measure and distinct downbeat marking.

### Requirement: Fixed Encoding Profile for Reproducibility
The fixture generator MUST use a fixed encoding profile for generated MP4 files.

#### Scenario: Repeat generation produces equivalent timing metadata
- **WHEN** the same fixture configuration is generated multiple times on the same toolchain
- **THEN** stream properties (frame rate, timebase, resolution, pixel format, and duration timing metadata) remain consistent across runs.

### Requirement: Leader-Length Scenario Support
The fixture generator SHALL support building fixtures with variable leader lengths to model D = 0, D > 0, and D < 0 mux alignment paths.

#### Scenario: D = 0 fixture pair
- **WHEN** video leader and audio leader are configured equal
- **THEN** generated scenario metadata indicates zero net alignment delta.

#### Scenario: D > 0 fixture pair
- **WHEN** video leader is shorter than audio leader
- **THEN** generated scenario metadata indicates positive alignment delta requiring video delay.

#### Scenario: D < 0 fixture pair
- **WHEN** video leader is longer than audio leader
- **THEN** generated scenario metadata indicates negative alignment delta requiring audio delay.

### Requirement: Optional Human-Review Preview Artifacts
The system SHALL support optional preview artifact generation for manual sync review.

#### Scenario: Preview generation enabled
- **WHEN** preview output mode is enabled
- **THEN** fixture generation emits review artifacts in a report path without changing pass/fail semantics of automated tests.

### Requirement: Section Name Overlay
The fixture generator SHALL support rendering the active section name as a persistent text overlay for the full duration of each section.

#### Scenario: Section label persists during section duration
- **WHEN** a section starts in the generated timeline
- **THEN** its section name appears on-screen at section start and remains visible until the next section boundary.

#### Scenario: Lead section renders blank label window
- **WHEN** the active section is designated as a lead/click-only section
- **THEN** no section text is shown while beat/downbeat pulse rendering remains active.

#### Scenario: Section labels advance at measure boundaries
- **WHEN** a song structure includes `Lead 2m`, `Intro 2m`, `Verse 1 2m`, `Chorus 2m`, `Outro 2m`
- **THEN** the overlay is blank during Lead, then shows `Intro`, `Verse 1`, `Chorus`, and `Outro` for their respective section windows.
