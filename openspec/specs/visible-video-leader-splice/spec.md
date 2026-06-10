# visible-video-leader-splice Specification

## Purpose
TBD - created by archiving change visible-black-leader-splice. Update Purpose after archive.
## Requirements
### Requirement: Visible Black Leader Generation
The system SHALL generate a visible black leader video segment for positive effective delta cases that require the video to appear paused before the original program begins.

#### Scenario: Positive delta creates black leader
- **WHEN** effective signed delta is positive (D > 0)
- **THEN** the system generates a black leader segment whose duration matches the required visible video delay.

#### Scenario: Leader segment matches source video shape
- **WHEN** generating the black leader segment
- **THEN** the system uses source video properties needed for concat/splice compatibility, including frame size and frame rate.

### Requirement: Video Splice Workflow
The system MUST splice the black leader segment ahead of the original video body for positive-delay outputs.

#### Scenario: Original body is preserved where compatible
- **WHEN** leader splice is possible without re-encoding the original body
- **THEN** the system concatenates the synthetic leader with the original video body while preserving the source body stream.

#### Scenario: Diagnostics identify visible leader workflow
- **WHEN** the splice workflow is selected
- **THEN** stderr reports that visible black leader generation and splice/concat were used, including the leader duration.

### Requirement: Test Refactor Coverage
The system MUST refactor existing mock and real mux tests to validate the visible black leader workflow where positive-delay scenarios require an actual visible pause.

#### Scenario: Mock tests assert splice behavior
- **WHEN** mock or unit mux tests exercise D > 0 behavior
- **THEN** they assert leader generation/splice selection rather than timestamp-only video delay.

#### Scenario: Real tests assert visible leader behavior
- **WHEN** real mux BDD tests exercise D > 0 behavior
- **THEN** they verify both sync correctness and presence of a visible black leader before the original video begins.

