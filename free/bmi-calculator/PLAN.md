# BMI Calculator PLAN

## Phase 1: Product metadata
- Update manifest metadata, health-focused tags, and adult wellness documentation for the BMI tool.
- Acceptance criteria: `utilivo verify` passes with real plugin metadata.

## Phase 2: Calculator workflow
- Implement the calculator flow in `tool/` with dual-unit input, live validation, BMI calculation, healthy-weight range output, and local state restore.
- Acceptance criteria: the tool works end-to-end from `tool/index.html`.

## Phase 3: Quality and release
- Add pure logic and storage tests under `tests/`, then build the signed `.ubb` bundle for inspection.
- Acceptance criteria: `utilivo test`, `utilivo build`, and `utilivo inspect` all pass.
