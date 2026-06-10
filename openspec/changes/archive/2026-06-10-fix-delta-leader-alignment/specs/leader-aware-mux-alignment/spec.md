## ADDED Requirements

### Requirement: Effective Signed Delta Calculation
The system SHALL compute an effective signed mux delta from video leader and click leader before invoking FFmpeg muxing.

#### Scenario: Positive effective delta delays video
- **WHEN** `video_downbeat_offset_ms` is greater than the first click timestamp in the generated timeline
- **THEN** effective signed delta is positive and the mux path delays the video stream by that absolute delta.

#### Scenario: Negative effective delta delays audio
- **WHEN** `video_downbeat_offset_ms` is less than the first click timestamp in the generated timeline
- **THEN** effective signed delta is negative and the mux path delays the audio stream by that absolute delta.

#### Scenario: Zero effective delta keeps streams aligned
- **WHEN** `video_downbeat_offset_ms` equals the first click timestamp in the generated timeline
- **THEN** effective signed delta is zero and no net stream delay is applied.

### Requirement: Leader-Aware Diagnostics
The system MUST emit deterministic diagnostics for leader-aware mux math on every pipeline run.

#### Scenario: Diagnostics include leader inputs and resolved delta
- **WHEN** pipeline invokes muxing
- **THEN** stderr includes `video_downbeat_offset_ms`, `first_click_timestamp_ms`, and `effective_signed_delta_ms` values used for delay selection.

### Requirement: Real Mux BDD Validation
The system MUST include a real mux BDD scenario that validates leader-aware signed-delta alignment against muxed media outputs.

#### Scenario: Real BDD verifies D > 0 with click intro
- **WHEN** a real fixture has a click intro that is longer than the source video leader
- **THEN** the BDD test asserts positive effective signed delta behavior and verifies muxed stream alignment with ffprobe-derived timings.

#### Scenario: Real BDD verifies D = 0 baseline
- **WHEN** a real fixture has matching click and video leader timing
- **THEN** the BDD test asserts zero effective signed delta behavior and verifies no net stream delay.

#### Scenario: Real BDD verifies D < 0 case
- **WHEN** a real fixture has click leader shorter than source video leader
- **THEN** the BDD test asserts negative effective signed delta behavior and verifies audio-delayed mux alignment.
