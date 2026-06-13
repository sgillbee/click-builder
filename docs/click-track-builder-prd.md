# Click Track Builder PRD

## 1. Product Summary

Click Track Builder transforms an existing video into a click-enabled performance video by generating timeline-driven audio stems (currently click and cues), then muxing them with the source video while preserving sync.

The tool is a local CLI pipeline with deterministic behavior intended for repeatable, Git-managed song configurations.

## 2. Goals

- Produce reliable click/cue aligned videos from structured YAML song definitions.
- Keep video and generated audio in precise sync using leader-aware math.
- Preserve source video quality by avoiding unnecessary re-encode paths.
- Support long-form scenarios (including complex 6/8 arrangements) with regression-safe validation.
- Evolve from simple click generation into a project-level mux configuration format.

## 3. Current Implementation Snapshot

### 3.1 Architecture

The implementation is a composable TypeScript CLI pipeline:

- config parser: YAML to AST
- timeline generator: AST to absolute timestamp events
- audio renderer: events to generated WAV mix via ffmpeg
- video muxer: generated audio + original video to output video
- orchestration CLI: runs full flow end to end

### 3.2 Implemented Behavior

- YAML supports tempo, time signature, structure, optional section-level overrides, and downbeat sync offset.
- Mid-song meter/tempo overrides are supported per section.
- Timeline uses absolute timestamp math with float millisecond precision.
- Click intro handling is leader-aware and contributes to effective mux delta calculation.
- Muxer supports signed alignment deltas (positive, zero, negative) and strategy-based ffmpeg invocation.
- Real mux BDD suite validates D=0, D>0, D<0, plus complex long-form 6/8 behavior.
- Fixture generator and manifest support deterministic real-mux scenario coverage.

### 3.3 Current CLI Contract

Current top-level command:

- click-builder [--allow-reencode] <config.yaml> <input-video> <output-video>

Current path ownership:

- YAML owns musical structure and sync offset values.
- CLI positional args own input video and output video paths.

## 4. Core Product Requirements (Current)

### 4.1 Config-Driven Song Definition

- YAML is the source of truth for musical timeline shape.
- Required baseline fields include name, tempo, time_signature, structure, and video_downbeat_offset_ms (or legacy alias).

### 4.2 Deterministic Timeline and Rendering

- Event timestamps must be absolute and deterministic.
- Events must carry stem identity and asset identity.
- Rendering must be reproducible for a fixed input config and asset set.

### 4.3 Video Sync and Muxing

- Effective sync delta must account for click leader duration.
- Mux behavior must remain explicit and debuggable via diagnostic logging.
- Positive-delay unsafe prepend behavior must fail unless explicit fallback is enabled.

### 4.4 Testing and Validation

- Unit tests per module.
- BDD real-mux tests are required for sync correctness and regression protection.

## 5. New Requirements: Stem Routing and Project Configuration

This section captures the agreed next requirements.

### 5.1 Routing Model Scope

- The system MUST model routing in neutral stem terms.
- It MUST NOT encode assumptions about playback environments (for example stage/ears/room semantics).
- Click and cue are stems.
- Full program audio extracted from source video is a stem.
- Future isolated stems are expected but not required for initial release.

### 5.2 YAML Stem Routing Section

Add a new YAML stems section where each stem can define source and routing.

Initial intent:

- Support generated stems (click, cue).
- Support source-video derived stem (instrumental_full) as a fully mixed stem.
- Keep schema extensible for future file-based or isolated stem sources.

### 5.3 Left/Right Routing Scale

- Routing values MUST be human-friendly integers from 0 to 100.
- Routing percentages represent contribution to left and right channels.
- Unspecified routing MUST default to left=100 and right=100.

Examples:

- click right-only: left=0, right=100
- instrumental left-only: left=100, right=0
- dual-channel stem: left=100, right=100

### 5.4 Empty Routing Is Allowed

- If no stem is routed to output, the system MAY produce silence.
- This is valid behavior and MUST NOT be treated as a schema error.

### 5.5 Source Resolution Failures

- Missing or invalid stem sources MUST fail loudly with clear diagnostics.
- Error output must identify the failing stem and failing source.

### 5.6 Deterministic Mix Ordering

- Mix application order MUST be deterministic.
- YAML declaration order should be preserved to keep runs reproducible.

### 5.7 Path Precedence for Project-Style Config

When input/output video paths exist in both CLI args and YAML, precedence is:

- CLI
- YAML
- error (if neither provides required path)

This enables a self-contained project file while preserving scriptable overrides.

## 6. Product Direction

### 6.1 Near-Term

- Introduce YAML stem routing for generated click/cue and source-video audio stem.
- Preserve backward compatibility through routing defaults (100/100).
- Add contract and BDD coverage for routing and precedence behavior.

### 6.2 Future

- Optional isolated stem sources (bgv, perc, pads, keys, guitars, and others).
- Optional advanced pan-law or gain staging features.
- Optional auto-detection tooling for downbeat sync (separate pipeline stage).

## 7. Non-Goals for Immediate Scope

- Tool-level assumptions about downstream A/V hardware or playback topology.
- Mandatory non-silent output.
- Full stem mixer workstation features.

## 8. Quality Bar

- Every requirement added in section 5 must be enforced by automated tests.
- BDD scenarios should include both happy paths and failure diagnostics.
- Real mux validations should continue to prove long-form sync integrity.
