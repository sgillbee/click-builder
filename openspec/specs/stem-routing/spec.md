# stem-routing Specification

## Purpose
TBD - created by archiving change stem-routing-project-config. Update Purpose after archive.

## Requirements
### Requirement: Declarative Stem Routing Configuration
The system SHALL support a YAML `stems` section where each declared stem defines a stable identity, source declaration, and optional left/right routing percentages.

#### Scenario: Stem declaration with explicit routing
- **WHEN** a config declares stems with `id`, `source`, and routing values
- **THEN** the pipeline parses the stem list as ordered declarations and preserves that order for downstream processing.

#### Scenario: Supported initial source types
- **WHEN** a config declares source types for generated click, generated cue, or full mixed source-video audio
- **THEN** each source type is accepted as valid and routed through the pipeline without requiring playback-environment semantics.

### Requirement: Integer Left/Right Routing Scale
The system SHALL interpret routing as integer percentages on a `0-100` scale for left and right output contributions.

#### Scenario: Percentage routing bounds
- **WHEN** routing values are provided outside `0-100`
- **THEN** validation fails with a clear schema error identifying the offending stem and field.

#### Scenario: Right-only click routing
- **WHEN** a stem routing is defined as left `0` and right `100`
- **THEN** that stem contributes only to the right output channel.

### Requirement: Routing Defaults and Silence Legality
The system SHALL default unspecified stem routing to `left=100` and `right=100`, and SHALL allow intentional silence when effective routing totals to zero across all stems.

#### Scenario: Unspecified routing fallback
- **WHEN** a declared stem omits routing values
- **THEN** the stem is treated as routed `100/100`.

#### Scenario: No routed output is valid
- **WHEN** all stem routing values resolve to zero contribution to both channels
- **THEN** the renderer produces a silent output track and the run is considered valid.

### Requirement: Legacy Stem-Free Compatibility
Existing YAML files without a `stems` section SHALL remain valid and SHALL continue to produce the current stereo behavior.

#### Scenario: Backward-compatible stem-free config
- **WHEN** a config omits the new `stems` section entirely
- **THEN** the stem-routing contract falls back to current behavior and existing BDD expectations remain unchanged.

### Requirement: Real BDD Golden Reference Reuse
New `@real` BDD coverage for the new YAML stem-routing format SHALL reuse the existing golden reference files as the regression baseline.

#### Scenario: New real BDD uses canonical golden files
- **WHEN** a real BDD scenario is written for the new YAML stem-routing format
- **THEN** it MUST validate against the existing golden reference assets instead of introducing a separate golden corpus.

#### Scenario: Legacy real BDD remains unchanged
- **WHEN** an existing real BDD scenario uses the pre-existing YAML format
- **THEN** it remains green unchanged and continues to exercise the same golden reference files.