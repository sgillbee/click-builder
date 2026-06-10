## ADDED Requirements

### Requirement: Timecode Sync Calculation
The muxer SHALL calculate the exact delay required to align the new click track count-in with the existing video, based on the `video_downbeat_offset` from the original config AST.

#### Scenario: Standard dynamic offset
- **WHEN** the config declares a `video_downbeat_offset` of `4.23s` and the generated timeline's count-in is `6.66s` long
- **THEN** the muxer applies an FFmpeg input offset (`-itsoffset`) calculation to appropriately freeze the video stream until alignment is reached.

#### Scenario: Positive offset delays video stream
- **WHEN** the mux alignment delta is positive (D > 0)
- **THEN** the muxer applies `-itsoffset` to the video input before mapping streams.

#### Scenario: Negative offset delays audio stream
- **WHEN** the mux alignment delta is negative (D < 0)
- **THEN** the muxer applies `-itsoffset` to the audio input before mapping streams.

#### Scenario: Zero offset applies no net delay
- **WHEN** the mux alignment delta is zero (D = 0)
- **THEN** the muxer emits `-itsoffset 0.000000` and stream alignment remains unchanged.

### Requirement: Lossless Video Pass-through
The muxer MUST NOT re-encode the original video stream during multiplexing.

#### Scenario: Codec copy execution
- **WHEN** the `video-muxer` executes FFmpeg
- **THEN** it invokes the command with the video copy directive (`-c:v copy` or equivalent wrapper configuration) to preserve the original compression.