> **IMPLEMENTATION RULE:** Commit your work after completing each numbered phase in this task list. Commits should be atomic to the phase being built (e.g., `git commit -m "feat(phase 2): implement config parser"`).

## 1. Project Initialization

- [x] 1.1 Scaffold project root with multi-tool build architecture
- [x] 1.2 Setup Vitest and Playwright (cucumber BDD style) for integration tests
- [x] 1.3 Add dependencies (yaml parser, zod for json validation, fluent-ffmpeg)

## 2. Config Parser

- [x] 2.1 Implement YAML parsing of file input
- [x] 2.2 Validate manual `video_downbeat_offset` and mid-song meter shifts using Zod schemas
- [x] 2.3 Build `config-parser` CLI interface to accept file arg and output AST JSON on `stdout`
- [x] 2.4 Verify all logging/errors route strictly to `stderr`

## 3. Timeline Generator

- [x] 3.1 Implement base BPM/ms math logic strictly using absolute time tracking (no relative accumulation)
- [x] 3.2 Build AST structure-to-timeline converter
- [x] 3.3 Build `timeline-generator` CLI interface to consume `stdin` AST and output event array payload to `stdout`

## 4. Audio Renderer

- [ ] 4.1 Write integration wrapper using FFmpeg filters (`adelay`, `amix`) to construct click tracks
- [ ] 4.2 Build `audio-renderer` CLI to parse JSON event `stdin` and output to requested/temp directory
- [ ] 4.3 Output final path `{ "generated_audio_path": "/file.wav" }` to `stdout`

## 5. Video Muxer

- [ ] 5.1 Implement `-itsoffset` math utilizing `video_downbeat_offset` minus generated count-in length
- [ ] 5.2 Configure FFmpeg execute sequence with `-v:c copy` lossless stream
- [ ] 5.3 Build `video-muxer` CLI to ingest `stdin` and string the final executable together

## 6. Pipeline Orchestration

- [ ] 6.1 Create master `click-builder` script that pipes all 4 tools together end-to-end
- [ ] 6.2 Write end-to-end BDD tests asserting pipeline flow using mock inputs and final file verification