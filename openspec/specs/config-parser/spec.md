# config-parser Specification

## Purpose
TBD - created by archiving change init-click-track-builder. Update Purpose after archive.
## Requirements
### Requirement: AST JSON Output Contract
The parser SHALL accept a YAML file and emit a flattened, standard JSON AST (Abstract Syntax Tree) to `stdout`.

#### Scenario: Basic config conversion
- **WHEN** the `config-parser` processes a valid YAML containing `tempo: 120` and `video_downbeat_offset_ms: 4230`
- **THEN** it outputs valid JSON to `stdout` containing the parsed configurations and exits with code `0`.

#### Scenario: Stem and project path normalization
- **WHEN** the parser processes YAML containing `stems` and optional project-level video paths
- **THEN** it emits normalized AST fields preserving stem order and applying routing defaults where routing is unspecified.

### Requirement: Stderr diagnostics
The parser SHALL NOT pollute `stdout` with anything other than valid parsable JSON.

#### Scenario: Debug logging isolation
- **WHEN** the parser is given a verbose or debug flag
- **THEN** all logs, warnings, and informational text MUST be routed strictly to `stderr`.

### Requirement: Mid-Song Meter Shifts
The parser SHALL strictly parse and maintain an array of meter changes over absolute measure indices to support mid-song time signature shifts (e.g., 4/4 to 3/4).

#### Scenario: Validating a 3/4 override
- **WHEN** the YAML config introduces an override to 3/4 time at measure 32
- **THEN** the output AST specifies the meter shift at exactly that index, so downstream beat calculation remains mathematically accurate.

### Requirement: Output JSON Schema Assertion
The parser SHALL enforce strict conformity to the CLI pipeline data contract by rejecting missing or invalid YAML structures before casting them.

#### Scenario: Missing downbeat timecode
- **WHEN** the input YAML omits the mandatory `video_downbeat_offset_ms`
- **THEN** the parser aborts immediately with a structured `stderr` error message detailing the schema violation, without writing to `stdout`.

#### Scenario: Invalid routing percentage
- **WHEN** a stem routing value is outside the accepted integer range `0-100`
- **THEN** the parser rejects the config with structured diagnostics identifying the field and stem.

### Requirement: Parser Backward Compatibility
The parser SHALL continue to accept pre-existing YAML files that do not define `stems` or project-level video path fields.

#### Scenario: Legacy YAML parses unchanged
- **WHEN** the parser receives an existing YAML file that only defines the current musical fields
- **THEN** it emits the same normalized AST shape required by the current BDD suite and does not require any migration step.

