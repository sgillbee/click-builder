## 1. Fallback Control Plumbing

- [x] 1.1 Add a CLI flag for explicit positive-delay re-encode fallback and thread that option into the pipeline and muxer input contracts.
- [x] 1.2 Update CLI-facing help and diagnostics so positive-delay failures explain that lossless prepend is the default and re-encode fallback is opt-in.

## 2. Safe Positive-Delay Muxing

- [x] 2.1 Tighten the positive-delay splice path so it probes prepend compatibility and validates splice-boundary timestamp continuity before accepting body-stream preservation.
- [x] 2.2 Make the positive-delay path fail clearly by default when safe lossless prepend cannot be validated, and add the explicit re-encode fallback path behind the new CLI flag.

## 3. Validation Coverage

- [x] 3.1 Update muxer and pipeline unit tests to cover fallback-control plumbing, safe lossless prepend acceptance, and default failure on unsafe positive-delay prepends.
- [x] 3.2 Update real mux BDD coverage to detect splice-boundary timestamp discontinuities for positive-delay outputs and to cover the explicit re-encode fallback behavior where appropriate.