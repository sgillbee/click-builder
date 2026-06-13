## 1. Contracts and Schema Foundations

- [x] 1.1 Extend `src/contracts.ts` YAML schema with `stems` declarations, initial source types, optional project video paths, and `0-100` routing validation.
- [x] 1.2 Extend AST/timeline-related contracts to carry normalized stem routing and project path metadata downstream.
- [x] 1.3 Add/adjust contract unit tests to verify routing defaults (`100/100`), bounds validation, and backward compatibility for configs without `stems`.

## 2. Parser and Normalization

- [x] 2.1 Update parser normalization in `src/parser/parser.ts` to map `stems` into canonical ordered declarations and apply routing defaults when omitted.
- [x] 2.2 Add parser support for optional YAML input/output video path fields while preserving existing required behavior for legacy configs.
- [x] 2.3 Add parser tests for invalid routing values, preserved declaration order, and structured stderr diagnostics.

## 3. Renderer Stem Routing and Source Resolution

- [x] 3.1 Refactor renderer routing application to consume canonical per-stem `left/right` percentages (`0-100`) and preserve deterministic mix order.
- [x] 3.2 Implement initial stem source resolution flow for generated click/cue and source-video full mixed audio stem.
- [x] 3.3 Implement loud failure diagnostics for missing/unresolvable stem sources including stem id and source context.
- [x] 3.4 Ensure zero-effective-routing output is treated as valid silent output and cover with unit/integration tests.

## 4. CLI and Pipeline Path Precedence

- [x] 4.1 Add project-level YAML path handling to orchestration and resolve required paths with precedence `CLI > YAML > error`.
- [x] 4.2 Update CLI/pipeline invocation contract and usage text to document precedence behavior.
- [x] 4.3 Add pipeline/CLI tests proving CLI override, YAML fallback, and explicit failure when both sources are missing.

## 5. Integration and BDD Coverage

- [x] 5.1 Add integration/BDD scenario for click right-only routing (`L=0/R=100`).
- [x] 5.2 Add integration/BDD scenario for instrumental left-only plus click/cue right-only routing.
- [x] 5.3 Add integration/BDD scenario validating no-routed-stems produces accepted silent output.
- [x] 5.4 Add integration/BDD scenario validating missing stem source fails loudly with clear diagnostics.
- [x] 5.5 Add regression scenario proving legacy config without `stems` remains green.
- [x] 5.6 Add @real BDD scenarios for the new YAML stem-routing format that reuse the existing golden reference files as the regression baseline.
- [x] 5.7 Add @real BDD coverage proving legacy golden-reference scenarios remain unchanged and green after the new format lands.

## 6. Documentation and Migration Notes

- [x] 6.1 Update user-facing docs with stem-routing examples and percentage semantics.
- [x] 6.2 Document project-style YAML path fields and `CLI > YAML > error` precedence.
- [x] 6.3 Add migration notes showing legacy config compatibility and recommended adoption path.

## 7. Validation Gate

- [x] 7.1 Keep the change open until `npm run build`, `npm run test`, and `npm run test:bdd` are green and `npm run test:coverage` is above 80%.
