## ADDED Requirements

### Requirement: YAML Input Configuration Schema
The system SHALL support and validate a standardized YAML configuration defining song parameters, structure, and video offset.

#### Scenario: Valid baseline config
- **WHEN** verifying the initial input
- **THEN** it must conform to the structure supporting `tempo`, `time_signature`, `video_downbeat_offset` (in milliseconds), and a `structure` array denoting sections, measures, and optional meter/tempo overrides.

### Requirement: AST JSON Pipeline Contract
The parser output and timeline-generator input SHALL strictly conform to a defined AST JSON schema to avoid pipeline mismatches. All time-based properties MUST use floating-point numbers to maintain strict sub-millisecond audio sample precision.

#### Scenario: AST serialization
- **WHEN** passing data downstream from the `config-parser`
- **THEN** the payload MUST be a JSON object containing `video_downbeat_offset_ms` (as a float) and a flattened array of `timeline_commands` where every section explicitly declares its calculated `bpm` and `meter`.

### Requirement: Timeline JSON Pipeline Contract
The timeline-generator output and audio-renderer input SHALL strictly conform to a Timeline JSON schema representing discrete multi-track stems. All timestamps MUST be floating-point values to prevent fractional sample jitter.

#### Scenario: Timeline event serialization
- **WHEN** passing data from the `timeline-generator` to the `audio-renderer`
- **THEN** the payload MUST be a JSON object containing an `events` array where every audio cue has an absolute `timestamp_ms` (as a float, e.g., `431.654676`), an explicit `stem` identifier (e.g., "click", "cue"), and an `asset` reference.