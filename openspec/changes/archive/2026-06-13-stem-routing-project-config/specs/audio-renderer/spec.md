## MODIFIED Requirements

### Requirement: Click sequence rendering
The renderer SHALL accept a JSON array of time-stamped events and output a single mixed audio track, utilizing standard volume normalization (e.g., target `-3dB`) configurable via the incoming AST.

#### Scenario: Audio creation execution
- **WHEN** the `audio-renderer` consumes a valid timeline JSON via `stdin`
- **THEN** it generates a continuous audio file layering the provided Ableton fragments at exactly the requested millisecond intervals, normalizing combined stems to prevent clipping peak distortion.

#### Scenario: Deterministic stem routing mix order
- **WHEN** the renderer applies stem routing declarations
- **THEN** it processes stems in YAML declaration order so repeated runs produce deterministic channel sums.

#### Scenario: Unspecified routing defaults to dual channel
- **WHEN** a stem omits explicit routing values
- **THEN** the renderer applies default routing `left=100` and `right=100` for that stem.

#### Scenario: Explicitly silent routing is valid
- **WHEN** effective left/right contributions across all stems resolve to zero
- **THEN** the renderer emits a valid silent output rather than failing validation.

#### Scenario: Missing stem source fails loudly
- **WHEN** a declared stem source cannot be resolved at render time
- **THEN** the renderer fails with a clear error including the stem id and source declaration context.

### Requirement: Output JSON path payload
The renderer MUST pass the location of the newly generated audio asset down the pipeline.

#### Scenario: Upstream path bridging
- **WHEN** the audio is successfully written to a temporary or output folder
- **THEN** it emits a JSON payload to `stdout` containing the absolute path to the generated audio file, and exits with code `0`.

### Requirement: Legacy Rendering Compatibility
The renderer SHALL continue to accept the existing timeline JSON contract for pre-existing YAML configurations that do not define new stem-routing fields.

#### Scenario: Legacy config uses existing renderer behavior
- **WHEN** the renderer receives timeline JSON derived from an existing YAML file without `stems`
- **THEN** it renders the same mixed audio behavior covered by the current BDD suite without requiring any migration.
