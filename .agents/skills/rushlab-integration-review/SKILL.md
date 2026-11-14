---
name: rushlab-integration-review
description: Review RushLab changes across domain, simulation, analytics, and UI boundaries. Use before merging an integration PR or changing shared contracts.
---

# RushLab integration review

Review like an owner; do not edit unless the user explicitly asks for fixes.

1. Read the assigned task, `AGENTS.md`, and the changed shared types before inspecting consumers.
2. Trace data from `Festival` through `runSimulation`, events/metrics/frames, comparison, and the UI surface affected by the change.
3. Prioritize correctness: incompatible types, hidden mutation, nondeterminism, metric duplication, unfair scenario assumptions, invalid placements, missing error/empty states, and regression-prone tests.
4. Confirm folder ownership and that the diff does not rewrite unrelated files or add unjustified dependencies.
5. Run the narrow checks first, then `npm run verify` when the change is a merge candidate.

Report actionable findings ordered by severity with file/line evidence and a concrete failure case. Do not produce style-only findings that CI already enforces. If there are no material findings, say so and list the verification performed and any residual risk.
