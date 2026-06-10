## ADDED Requirements

### Requirement: Click sequence rendering
The renderer SHALL accept a JSON array of time-stamped events and output a single mixed audio track, utilizing standard volume normalization (e.g., target `-3dB`) configurable via the incoming AST.

#### Scenario: Audio creation execution
- **WHEN** the `audio-renderer` consumes a valid timeline JSON via `stdin`
- **THEN** it generates a continuous audio file layering the provided Ableton fragments at exactly the requested millisecond intervals, normalizing combined stems to prevent clipping peak distortion.

### Requirement: Output JSON path payload
The renderer MUST pass the location of the newly generated audio asset down the pipeline.

#### Scenario: Upstream path bridging
- **WHEN** the audio is successfully written to a temporary or output folder
- **THEN** it emits a JSON payload to `stdout` containing the absolute path to the generated audio file, and exits with code `0`.