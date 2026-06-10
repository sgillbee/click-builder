## ADDED Requirements

### Requirement: AST JSON Output Contract
The parser SHALL accept a YAML file and emit a flattened, standard JSON AST (Abstract Syntax Tree) to `stdout`.

#### Scenario: Basic config conversion
- **WHEN** the `config-parser` processes a valid YAML containing `tempo: 120` and `video_downbeat_offset: 4230`
- **THEN** it outputs valid JSON to `stdout` containing the parsed configurations and exits with code `0`.

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
- **WHEN** the input YAML omits the mandatory `video_downbeat_offset`
- **THEN** the parser aborts immediately with a structured `stderr` error message detailing the schema violation, without writing to `stdout`.