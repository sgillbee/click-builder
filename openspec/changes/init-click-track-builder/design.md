## Context

The click-track builder requires precision audio mathematics and media manipulation. Originally conceived as a single Node CLI, the architecture is pivoting to a Unix-style pipeline of composable micro-tools. This shift ensures the system is easier to test strictly via BDD, allows technology swapping (e.g. Node for parsing, Python for MIR later), and keeps dependencies cleanly separated.

## Goals / Non-Goals

**Goals:**
- Implement a suite of CLI tools: `parser`, `timeline`, `audio`, and `muxer`.
- Guarantee standard `json` data flow across `stdout`, isolating detailed diagnostic metrics and logs to `stderr`.
- Enforce strict GWT integration testing against the pipeline interfaces, not just internal function tests.
- Support manual timecode alignment for the video's downbeat in the YAML config.

**Non-Goals:**
- Fully autonomous AI/MIR downbeat detection (slated for future replacement of the manual timecode phase).
- Re-encoding video files natively.

## Decisions

- **Pipeline Architecture (Unix Philosophy)**: We will separate logic into distinct executable scripts. Reason: Audio math logic should not be tightly coupled to FFmpeg parsing or YAML loading. This drastically simplifies Vitest/Cucumber integration by allowing us to input mock JSON ASTs and assert JSON outputs safely without invoking FFmpeg.
- **Data Flow Contract**: Tools listen for configurations or upstream output on `stdin` and print downstream json on `stdout`. Side-effects (FFmpeg logs, error trails, calculations) are dumped to `stderr`.
- **Manual Video Timecode (`video_downbeat_offset`)**: The YAML config will accept a manual millisecond target for Beat 1. This prevents the initial MVP from being blocked by complex AI audio transient detection while protecting user sync latency.
- **Language Hybridity**: While we'll likely start with Node.js/TypeScript for strong JSON typings via Zod, this pattern immediately enables dropping in a Python module without changing the overarching logic of the pipeline.

## Risks / Trade-offs

- **[Risk] Slower execution due to process spawning**: Running four distinct CLI processes might be marginally slower overhead than a single monolithic NodeJS event loop. 
  - **Mitigation**: The heavy lifting lives in FFmpeg (C++) and is asynchronous. The wrapper overhead is entirely negligible for offline processing tasks like this.
- **[Risk] Managing temp files across the pipeline**: The audio phase creates a `.wav` file that the mux phase needs.
  - **Mitigation**: The `audio-renderer` outputs a JSON payload containing the `{ "generated_audio_path": "/tmp/...wav" }` to `stdout` so the `video-muxer` knows where to pull from.