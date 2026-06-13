# video-muxer Specification

## Purpose
TBD - created by archiving change init-click-track-builder. Update Purpose after archive.
## Requirements
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

### Requirement: Project Path Precedence Compatibility
The muxing workflow SHALL receive resolved path inputs from orchestration that honor precedence `CLI > YAML > error`.

#### Scenario: CLI path override reaches mux step
- **WHEN** both CLI and YAML provide output video paths
- **THEN** the mux operation is invoked with the CLI-selected output path.

#### Scenario: Missing path prevents mux invocation
- **WHEN** required path values are absent after precedence resolution
- **THEN** muxing does not begin and a clear error is emitted.

### Requirement: Legacy Mux Workflow Compatibility
The muxer SHALL continue to support the current CLI-driven workflow for existing YAML files that do not provide project-level path fields.

#### Scenario: Legacy mux workflow remains green
- **WHEN** an existing config continues to provide paths through CLI arguments only
- **THEN** muxing behavior remains unchanged from the current contract and legacy BDD coverage stays green.

