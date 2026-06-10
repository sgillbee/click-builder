## MODIFIED Requirements

### Requirement: Timecode Sync Calculation
The muxer SHALL calculate the exact delay required to align generated click-track downbeats with the source video downbeat by using the effective signed delta derived from leader-aware timing inputs.

#### Scenario: Standard dynamic offset
- **WHEN** the pipeline provides an effective signed delta derived from `video_downbeat_offset_ms` and generated timeline leader timing
- **THEN** the muxer applies an FFmpeg input offset (`-itsoffset`) to the correct stream based on the sign of that delta.

#### Scenario: Positive offset delays video stream
- **WHEN** the mux alignment delta is positive (D > 0)
- **THEN** the muxer applies `-itsoffset` to the video input before mapping streams.

#### Scenario: Negative offset delays audio stream
- **WHEN** the mux alignment delta is negative (D < 0)
- **THEN** the muxer applies `-itsoffset` to the audio input before mapping streams.

#### Scenario: Zero offset applies no net delay
- **WHEN** the mux alignment delta is zero (D = 0)
- **THEN** the muxer emits `-itsoffset 0.000000` and stream alignment remains unchanged.
