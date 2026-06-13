## 1. Video-Anchored Duration Policy

- [x] 1.1 Probe source video duration in the muxer and replace the current final `-shortest` policy with a video-anchored duration strategy.
- [x] 1.2 Normalize generated audio to the source video duration by padding silent tail when audio ends early and trimming audio when it overruns the video.

## 2. Truncation Diagnostics

- [x] 2.1 Emit a deterministic warning when generated audio is truncated to source video duration, including the overrun amount.
- [x] 2.2 Ensure the short-audio silent-tail path does not emit a truncation warning.

## 3. Validation Coverage

- [x] 3.1 Update muxer-focused unit tests to cover short-audio silent tails, long-audio truncation, and warning behavior.
- [x] 3.2 Update real mux BDD coverage to verify full source-video retention when audio ends early and to assert truncation-warning behavior when audio exceeds video length.