## ADDED Requirements

### Requirement: Explicit Positive-Delay Re-encode Override
The system SHALL require an explicit runtime opt-in before falling back to a re-encoded positive-delay stitch when safe lossless prepend validation fails.

#### Scenario: Fallback disabled by default
- **WHEN** a positive-delay output cannot be completed with a validated lossless prepend and no override flag is supplied
- **THEN** the system fails the build with a clear error instead of re-encoding automatically.

#### Scenario: CLI flag enables re-encode fallback
- **WHEN** a positive-delay output cannot be completed with a validated lossless prepend and the override flag is supplied
- **THEN** the system may produce the output by re-encoding the positive-delay stitched video.

### Requirement: Fallback Diagnostics
The system MUST report whether the positive-delay output used a validated lossless prepend, failed due to unsafe prepend conditions, or used the explicit re-encode fallback.

#### Scenario: Failure message names the override
- **WHEN** the safe lossless prepend path is rejected and fallback is disabled
- **THEN** diagnostics explain that the output was aborted because lossless prepend validation failed and that re-encode fallback requires the explicit CLI override.

#### Scenario: Re-encode fallback is disclosed
- **WHEN** the override flag permits re-encode fallback
- **THEN** diagnostics state that the positive-delay output was produced via re-encode fallback rather than body-stream preservation.