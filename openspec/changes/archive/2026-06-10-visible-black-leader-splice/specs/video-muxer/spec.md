## MODIFIED Requirements

### Requirement: Timecode Sync Calculation
The muxer SHALL align generated click-track downbeats with the source video downbeat using leader-aware signed-delta logic, and SHALL use a visible black-leader splice workflow for positive-delay outputs that require a visible pause.

#### Scenario: Positive offset uses visible leader workflow
- **WHEN** the mux alignment delta is positive (D > 0)
- **THEN** the muxer generates and splices a visible black leader segment ahead of the original video instead of relying solely on timestamp offsetting.

#### Scenario: Negative offset delays audio stream
- **WHEN** the mux alignment delta is negative (D < 0)
- **THEN** the muxer applies `-itsoffset` to the audio input before mapping streams.

#### Scenario: Zero offset applies no net delay
- **WHEN** the mux alignment delta is zero (D = 0)
- **THEN** the muxer emits no visible leader and stream alignment remains unchanged.

### Requirement: Lossless Video Pass-through
The muxer MUST preserve the original video body stream without re-encoding when the visible leader splice workflow has compatible source parameters.

#### Scenario: Compatible splice preserves original body
- **WHEN** source video and generated leader are concat-compatible
- **THEN** the original program body is preserved without re-encoding during final output assembly.
