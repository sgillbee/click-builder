## 1. Source-Probed Leader Splice Path

- [x] 1.1 Add source video probing needed to capture concat-critical properties for leader generation.
- [x] 1.2 Implement black leader video generation for D > 0 using the required leader duration.
- [x] 1.3 Implement concat/splice assembly that preserves the original video body without re-encoding when compatibility checks pass.

## 2. Mux Branching and Diagnostics

- [x] 2.1 Update mux path selection so positive effective delta uses the visible black leader splice workflow.
- [x] 2.2 Preserve existing D = 0 and D < 0 behavior unless visible leader generation is explicitly required.
- [x] 2.3 Emit diagnostics describing leader duration, selected splice workflow, and whether original body stream copy was preserved.

## 3. Test Refactor and Validation

- [x] 3.1 Refactor existing mock/unit mux tests so positive-delay cases assert black-leader generation/splice behavior instead of timestamp-only delay.
- [x] 3.2 Refactor existing real mux BDD scenarios where appropriate to validate visible black leader behavior for D > 0 outputs.
- [x] 3.3 Keep or extend D = 0 and D < 0 real/mock tests to prove they remain on the non-splice paths.
- [x] 3.4 Run focused mock/unit and real mux validation commands to verify both splice behavior and preserved sync.
