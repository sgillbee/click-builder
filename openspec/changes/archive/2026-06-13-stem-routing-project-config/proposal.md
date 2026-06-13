## Why

The current pipeline always renders generated click/cue into a fixed stereo mix and requires video input/output paths as positional CLI arguments. We need stem-based left/right routing and project-style YAML I/O so users can produce deterministic routing outcomes (for example click-only on right) without embedding playback-system assumptions.

This is needed now because routing control has become a core workflow requirement and the config is already acting as orchestration metadata beyond click shape alone.

## What Changes

- Add YAML `stems` configuration with stem identity, source declaration, and left/right routing percentages.
- Introduce initial supported stem sources for generated click, generated cue, and full mixed audio derived from source video.
- Define routing model using integer percentages `0-100` with default fallback of `left=100`, `right=100` when routing is unspecified.
- Allow intentionally silent output when no stems route to output channels.
- Require loud, explicit failures for missing or unresolvable stem sources.
- Enforce deterministic stem mix order based on YAML declaration order.
- Add project-style YAML path fields for input/output video and resolve path precedence as `CLI > YAML > error`.
- Preserve backward compatibility for existing configs that do not define `stems`.

## Capabilities

### New Capabilities
- `stem-routing`: Declarative stem source and L/R routing contracts for generated and source-derived audio stems.
- `project-io-config`: Project-style YAML input/output path support with deterministic path precedence and compatibility behavior.

### Modified Capabilities
- `data-contracts`: Extend YAML, AST/timeline contracts, and validation rules to include stem-routing and project path metadata.
- `audio-renderer`: Update renderer requirements to consume stem routing declarations, respect defaults, preserve order, and validate source resolution failures.
- `config-parser`: Update parser requirements to map stem/project YAML fields into normalized downstream contracts while maintaining backward compatibility.
- `video-muxer`: Update muxer input requirements to support CLI/YAML path precedence contract for project-style config.

## Impact

- Affected code:
  - `src/contracts.ts`
  - `src/parser/parser.ts` and parser CLI behavior
  - `src/timeline/generator.ts` contract propagation
  - `src/audio/renderer.ts` and renderer CLI input handling
  - `src/pipeline.ts` and `src/cli.ts` path precedence resolution
  - muxer input contract handling in `src/muxer/contracts.ts`
- Affected tests:
  - unit tests for contracts/parser/renderer/pipeline precedence
  - BDD/integration coverage for routing profiles, silence-allowed behavior, failure diagnostics, and backward compatibility
- API/contract impact:
  - YAML schema expands with `stems` and optional project I/O fields
  - downstream JSON contracts gain stem-routing metadata
- Dependencies/systems:
  - no new external services required
  - ffmpeg pipeline usage remains foundational
