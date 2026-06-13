## MODIFIED Requirements

### Requirement: Timecode Sync Calculation
The muxer SHALL calculate the exact delay required to align generated click-track downbeats with the source video downbeat by using the effective signed delta derived from leader-aware timing inputs.

#### Scenario: Standard dynamic offset
- **WHEN** the pipeline provides an effective signed delta derived from `video_downbeat_offset_ms` and generated timeline leader timing
- **THEN** the muxer applies an FFmpeg input offset (`-itsoffset`) to the correct stream based on the sign of that delta.

#### Scenario: Positive offset prepends validated leader video
- **WHEN** the mux alignment delta is positive (D > 0)
- **THEN** the muxer prepends the required visible leader only through a workflow that validates splice compatibility and stitched timestamp continuity before accepting lossless body preservation.

#### Scenario: Negative offset delays audio stream
- **WHEN** the mux alignment delta is negative (D < 0)
- **THEN** the muxer applies `-itsoffset` to the audio input before mapping streams.

#### Scenario: Zero offset applies no net delay
- **WHEN** the mux alignment delta is zero (D = 0)
- **THEN** the muxer emits `-itsoffset 0.000000` and stream alignment remains unchanged.

### Requirement: Lossless Video Pass-through
The muxer MUST preserve the original video body stream without re-encoding only when the positive-delay leader prepend workflow has verified both splice compatibility and splice-boundary timestamp continuity.

#### Scenario: Compatible prepend preserves original body
- **WHEN** source video and generated leader satisfy the muxer compatibility checks and the stitched output passes continuity validation
- **THEN** the original program body is preserved without re-encoding during final output assembly.

#### Scenario: Unsafe prepend fails by default
- **WHEN** the positive-delay prepend workflow detects incompatible splice conditions or a timestamp discontinuity and re-encode fallback is not enabled
- **THEN** the muxer fails with a clear error instead of writing a silently shifted output.

### Requirement: Positive-Delay Splice Validation
The muxer MUST validate positive-delay stitched outputs at the splice boundary before declaring lossless body preservation successful.

#### Scenario: Boundary timestamps remain continuous
- **WHEN** the muxer evaluates a positive-delay stitched video
- **THEN** it confirms that frame timestamps remain monotonic through the leader-to-body transition.

#### Scenario: Boundary discontinuity rejects lossless prepend
- **WHEN** the muxer detects a frame timestamp gap or non-monotonic transition at the leader-to-body splice boundary
- **THEN** the lossless prepend attempt is rejected as unsafe.

## ADDED Requirements

### Requirement: Video-Anchored Final Duration
The muxer MUST anchor final output duration to the source video duration rather than the shorter of video and generated audio.

#### Scenario: Short audio reaches full video end in silence
- **WHEN** generated audio ends before the source video reaches its natural end
- **THEN** the muxer preserves the full source video duration and pads the remaining audio tail with silence.

#### Scenario: Long audio is trimmed to video end
- **WHEN** generated audio extends beyond the source video duration
- **THEN** the muxer trims audio at the source video end so the final output duration still matches the source video duration.

### Requirement: Audio Truncation Warning
The muxer MUST emit a deterministic warning when generated audio is truncated because it exceeds source video duration.

#### Scenario: Warning reports truncated amount
- **WHEN** generated audio is trimmed to match the source video end
- **THEN** diagnostics report that audio was truncated and include the overrun amount.

#### Scenario: Silent tail does not warn
- **WHEN** generated audio ends before source video duration and the muxer pads the tail with silence
- **THEN** diagnostics do not emit an audio-truncation warning.