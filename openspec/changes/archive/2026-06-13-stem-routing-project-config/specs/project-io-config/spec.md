## ADDED Requirements

### Requirement: Project-Level Video Path Configuration
The system SHALL allow YAML project configuration to define input and output video paths used by the orchestration pipeline.

#### Scenario: YAML-defined project paths
- **WHEN** YAML includes both input and output video paths
- **THEN** the pipeline can execute without requiring positional CLI video path arguments.

### Requirement: Path Resolution Precedence
The system SHALL resolve required video paths using precedence `CLI > YAML > error`.

#### Scenario: CLI overrides YAML paths
- **WHEN** a path is provided in both CLI arguments and YAML
- **THEN** the CLI-provided value is used.

#### Scenario: YAML fills missing CLI paths
- **WHEN** CLI omits a required path and YAML provides it
- **THEN** the YAML value is used.

#### Scenario: Missing path in both sources
- **WHEN** a required path is absent from both CLI and YAML
- **THEN** the command fails with a clear error explaining the missing value and precedence rule.

### Requirement: Automation Compatibility
The system SHALL preserve automation compatibility for existing scripts that provide positional CLI paths.

#### Scenario: Legacy script compatibility
- **WHEN** existing automation invokes CLI positional paths with no YAML project path fields
- **THEN** behavior remains unchanged from prior contract.

### Requirement: Legacy Path Workflow Compatibility
Existing YAML files and scripts without project-level path fields SHALL continue to work without migration.

#### Scenario: Existing path workflow remains valid
- **WHEN** a project omits YAML input/output path fields and continues to pass paths via CLI
- **THEN** the current workflow remains valid and existing BDD coverage does not need to change.
