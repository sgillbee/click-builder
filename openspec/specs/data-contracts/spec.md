# data-contracts Specification

## Purpose
TBD - created by archiving change init-click-track-builder. Update Purpose after archive.
## Requirements
### Requirement: YAML Input Configuration Schema
The system SHALL support and validate a standardized YAML configuration defining song parameters, structure, video offset, optional project-level video input/output paths, and stem routing declarations.

#### Scenario: Valid baseline config
- **WHEN** verifying the initial input
- **THEN** it must conform to the structure supporting `tempo`, `time_signature`, `video_downbeat_offset_ms` (in milliseconds), and a `structure` array denoting sections, measures, and optional meter/tempo overrides.

#### Scenario: Valid stem and project path extensions
- **WHEN** YAML includes a `stems` array and optional project-level video path fields
- **THEN** schema validation accepts these fields and enforces routing percentage bounds and source shape requirements.

### Requirement: AST JSON Pipeline Contract
The parser output and timeline-generator input SHALL strictly conform to a defined AST JSON schema to avoid pipeline mismatches. All time-based properties MUST use floating-point numbers to maintain strict sub-millisecond audio sample precision.

#### Scenario: AST serialization
- **WHEN** passing data downstream from the `config-parser`
- **THEN** the payload MUST be a JSON object containing `video_downbeat_offset_ms` (as a float) and a flattened array of `timeline_commands` where every section explicitly declares its calculated `bpm` and `meter`.

#### Scenario: AST includes normalized stem metadata
- **WHEN** `stems` are present in YAML
- **THEN** parser output includes normalized stem declarations preserving declared order and applying default routing values when omitted.

### Requirement: Muxer Input Contract
The muxer input SHALL carry a signed floating-point alignment delta in milliseconds.

#### Scenario: Signed alignment payload
- **WHEN** data is passed into the `video-muxer`
- **THEN** `video_downbeat_offset_ms` MAY be positive, zero, or negative to represent the stream that should be delayed for alignment.

#### Scenario: Muxer input path resolution contract
- **WHEN** orchestration prepares muxer input paths
- **THEN** required video path fields are provided after applying precedence `CLI > YAML > error`.

### Requirement: Timeline JSON Pipeline Contract
The timeline-generator output and audio-renderer input SHALL strictly conform to a Timeline JSON schema representing discrete multi-track stems. All timestamps MUST be floating-point values to prevent fractional sample jitter.

#### Scenario: Timeline event serialization
- **WHEN** passing data from the `timeline-generator` to the `audio-renderer`
- **THEN** the payload MUST be a JSON object containing an `events` array where every audio cue has an absolute `timestamp_ms` (as a float, e.g., `431.654676`), an explicit `stem` identifier (e.g., "click", "cue"), and an `asset` reference.

#### Scenario: Timeline payload carries stem routing metadata
- **WHEN** routing is defined or defaulted for stems
- **THEN** the timeline-to-renderer payload includes the effective routing metadata needed to produce deterministic channel contributions.

### Requirement: Legacy YAML Compatibility Contract
Legacy YAML configurations SHALL remain valid and SHALL continue to map into the existing pipeline contract without requiring a migration step.

#### Scenario: Legacy config without stems remains valid
- **WHEN** a YAML file omits the new `stems` and project path fields
- **THEN** the resulting contracts preserve the current behavior and remain compatible with the existing BDD suite unchanged.

#### Scenario: New fields are additive only
- **WHEN** a YAML file includes the new `stems` or project path fields
- **THEN** those fields are treated as additive extensions and do not invalidate legacy configs.

