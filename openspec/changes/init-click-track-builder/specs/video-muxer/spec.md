## ADDED Requirements

### Requirement: Timecode Sync Calculation
The muxer SHALL calculate the exact delay required to align the new click track count-in with the existing video, based on the `video_downbeat_offset` from the original config AST.

#### Scenario: Standard dynamic offset
- **WHEN** the config declares a `video_downbeat_offset` of `4.23s` and the generated timeline's count-in is `6.66s` long
- **THEN** the muxer applies an FFmpeg input offset (`-itsoffset`) calculation to appropriately freeze the video stream until alignment is reached.

### Requirement: Lossless Video Pass-through
The muxer MUST NOT re-encode the original video stream during multiplexing.

#### Scenario: Codec copy execution
- **WHEN** the `video-muxer` executes FFmpeg
- **THEN** it invokes the command with the video copy directive (`-c:v copy` or equivalent wrapper configuration) to preserve the original compression.