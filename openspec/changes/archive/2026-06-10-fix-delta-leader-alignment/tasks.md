## 1. Leader-Aware Delta Contract

- [x] 1.1 Add/extend contract fields so mux input can carry effective signed delta and leader timing diagnostics.
- [x] 1.2 Derive first click timestamp from generated timeline events and fail fast when no click event exists.
- [x] 1.3 Compute effective signed delta as `video_downbeat_offset_ms - first_click_timestamp_ms` before mux invocation.

## 2. Mux Behavior and Diagnostics

- [x] 2.1 Update mux argument builder to apply `-itsoffset` from effective signed delta sign/magnitude.
- [x] 2.2 Keep D > 0 delaying video, D < 0 delaying audio, and D = 0 emitting zero net delay.
- [x] 2.3 Emit deterministic stderr diagnostics for `video_downbeat_offset_ms`, `first_click_timestamp_ms`, and `effective_signed_delta_ms`.

## 3. Automated Validation

- [x] 3.1 Add/expand unit tests for leader-aware delta math covering D > 0, D = 0, and D < 0.
- [x] 3.2 Add a real BDD mux scenario validating D > 0 click-intro behavior with ffprobe timing assertions.
- [x] 3.3 Extend real BDD mux validation to confirm D = 0 and D < 0 leader-aware alignment remains correct.
- [x] 3.4 Run focused real mux BDD and fixture generation commands to verify regressions are caught and diagnostics are present.
