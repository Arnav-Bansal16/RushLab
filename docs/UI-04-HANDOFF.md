# UI-04 acceptance checklist and dependency gate

## Status: blocked before implementation

Audit date: 2026-11-14. Base: freshly fetched GitHub `origin/main`,
`236028523928d8a7725f115713209d8bfbb0f688`.
Branch: `codex/ui-04-behavior-controls`. The worktree was clean before branching.
This document is a pre-implementation checklist, not a completion report.

## Dependency evidence and required resolution

- Complete: SIM-02 (#4), UI-02 (#3), and ANA-01 (#6) are merged ancestors of
  fetched main, verified with git history. This confirms merge presence only;
  it does not certify today's tests.
- Complete: CON-02 PR #7 is merged at the base above; GitHub's PR API confirms
  merge commit `2360285`, head `d8adde7`.
- Blocked: required joint review cannot be verified. GitHub review submissions
  and combined discussion timeline for PR #7 both returned empty arrays.
  A merge by itself is not evidence that both developers approved. Supply
  attributable approval from both developers for the merged contracts and fixtures.
- Blocked: the request requires at most three destinations, but merged
  `src/domain/behavior.ts`, ARCHITECTURE, TASKS, INTEGRATION, and HANDOFF define
  default four, allowed one through six, plus per-type and revisit limits.
  Resolve this explicitly before implementation. If three is required, jointly
  review and merge a separate contract/default/fixture amendment first. UI-04
  must not silently cap or rewrite the shared defaults.
- Pending contract clarification: `validateBehaviorSettings` accepts all-zero
  weights. INTEGRATION specifies safe exit when no eligible destination remains,
  but does not explicitly distinguish all-zero intent weights from all-zero
  eligible destination weights. Obtain approved semantics for both cases;
  do not invent frontend normalization or fallback intent selection.
- SIM-03 has no merge in fetched main. The current HANDOFF explicitly says
  behavior is not implemented. Real price/behavior integration remains unverified;
  its absence alone would not block UI-04 after the joint-review gate is met.

## Handoff audit and acceptance mapping

All existing handoff documents are included below. No CON-02, SIM-03, ANA-03,
previous UI-04, or other newer handoff file exists at this base. “Pending” means
implementation/check still required; references to existing code are inspection
findings, not a passing verification claim. All implementation work is gated by
joint approval and the stop-limit conflict above.

| Source | UI-04 requirement | Existing or intended implementation | Verification required | Status |
| --- | --- | --- | --- | --- |
| HANDOFF; TASKS UI-04 | Create/edit vendor averagePrice; currency display units | editor ComponentForm/layout | creation/edit tests; edited price captured by engine spy; manual keyboard check | pending |
| HANDOFF; TASKS UI-04 | Service time and optional location dwell overrides from current scope | editor forms/input snapshot | bounds/range tests and snapshot preservation | pending |
| HANDOFF; ARCHITECTURE; behavior.ts | Approved defaults, intent/destination weights, stop limits, dwell ranges, roam count, queue multiplier, elasticity | focused simulation-settings feature using shared resolver/defaults | default equality; each setting reaches engine unchanged | blocked |
| HANDOFF; TASKS UI-04 | Current per-type/revisit and exit settings scope | shared behavior contract; scope resolution before controls | limit dependencies, integer bounds, unchanged snapshot values | blocked |
| HANDOFF; INTEGRATION | Zero/missing eligible types; weights are relative tendencies | approved validation semantics; no UI choices | zero-intent and zero-destination cases, absent types, no destinations | blocked |
| HANDOFF; TASKS UI-04 | Field errors; finite prices/weights; bounded multipliers; ordered ranges; empty/malformed editing | string drafts and shared validation in editor/settings | negative, NaN, infinity, empty, malformed, fractional count, out-of-range tests | pending |
| HANDOFF; UI-02-ANA-01-UI-03-HANDOFF | Visible modeled assumptions, no forecast or guaranteed-percent claims | settings/presentation copy | rendered copy assertions; desktop/mobile inspection | pending |
| SIM-01-HANDOFF | Preserve prepareSimulationInput then public runSimulation; no invalid execution | editor/simulationInput.ts and playback/run.ts executeRun | invalid-input engine spy; warnings; real engine handoff test | pending |
| SIM-01-HANDOFF; UI-02-ANA-01-UI-03-HANDOFF | Independent festival/settings/result/warnings; deep nested snapshots | existing executeRun clones; extend validated input handling | mutate later layout/price/nested settings; defaults/input immutability | pending |
| UI-02-ANA-01-UI-03-HANDOFF | Rejected attempt retains identified previous success; snapshot metadata | existing PlaybackWorkspace flow | rejected rerun test/manual check; no render-triggered rerun | pending |
| SIM-01-HANDOFF | Blank draft permitted; entrance required; gate-only/multiple gates; annotations excluded | existing simulationInput; preserve approved amenities | gate-only, multiple-gate, missing-type and fixture integration checks | pending |
| SIM-01-HANDOFF; SIM-02-UI-02-HANDOFF | Meter coordinates, complete sparse frames, absent unspawned attendees, exited identity; last frame may precede duration | playback controller/canvas | empty/single/first/sparse/final frames; no event reconstruction | pending |
| SIM-02-UI-02-HANDOFF; UI-02-ANA-01-UI-03-HANDOFF | Play/pause/restart/scrub/speed/boundaries and background-tab behavior | existing playback controller/animation | existing controller/animation tests plus regression checks | pending |
| SIM-02-UI-02-HANDOFF | Waiting queue excludes service; sales are purchases; null unlimited and zero out of stock | existing vendorDisplay consumes frame values directly | direct frame-value presentation tests | pending |
| HANDOFF; merged CON-02 | Generic target, dwelling, all statuses; safe null/absent destination | existing presentation.ts has generic lookup/status styles | all target types/statuses, null/stale IDs, reviewed multiDestination fixture | pending |
| HANDOFF; SIM-01-HANDOFF | Only approved vendor/stage/amenity destinations; routing/visual objects never inferred | public frames only | target handling tests; diff review for inferred behavior | pending |
| SIM-02-ANA-01-HANDOFF; UI-02-ANA-01-UI-03-HANDOFF | Canonical metrics from final result/events; dashboard stable while scrubbing | preserve result boundary; no dashboard edits | regression integration check and UI formula/import audit | pending |
| SIM-02-ANA-01-HANDOFF | Implement event reducer, conservation, inventory and metric formulas | analytics/simulation owners | owning backend suites, not new frontend formulas | not applicable |
| HANDOFF developer B | Intent assignment, choice, affordability, roaming, dwell/queue timing, typed exits | SIM-03 owner | backend suites and later public engine integration | not applicable |
| HANDOFF; UI-02-ANA-01-UI-03-HANDOFF | ANA-03/UI-03/INT-01/comparison/recommendations and deployment | downstream owners | separate tasks and release gates | not applicable |
| All handoffs; TESTING | Shared fixtures and real engine output remain compatible | reviewed fixtures unchanged; public simulation import | focused editor/settings/playback tests; real run rendering | pending |
| UI-02-ANA-01-UI-03-HANDOFF; TASKS UI-02 | 300-circle playback at 30+ FPS | current implementation must be measured anew | machine/browser/method/FPS/limitations recorded below | pending |

Historical completion claims and performance numbers were not used to mark
implementation requirements complete. SIM-01/SIM-02 historical limitations are
context; the merged CON-02 contract governs eventual presentation.

## Verification and manual checks

No application code changed. No tests or build were run for this documentation-only
blocked checklist; no old passing result is presented as current verification.
After the gate is resolved, run focused editor/settings/playback tests, then:

```bash
npm test -- src/features/playback src/simulation
npm run verify
```

Every manual check is currently unverified because implementation is gated:

- Vendor creation, price editing, and keyboard operation.
- Advanced settings validation, descriptions, and keyboard access.
- Visible modeled-assumption copy.
- Run then edit price/layout/nested settings; prior run remains fixed.
- Invalid rerun preserves and labels prior successful output; warnings visible.
- Missing destination types, no eligible destinations, and approved zero-weight cases.
- Generic targets/dwelling from a real engine run (also awaits SIM-03).
- Desktop and narrow/mobile layout.
- 300-attendee/circle playback performance: machine not measured, browser not
  selected, measurement method not performed, FPS unknown. No performance
  acceptance claim; record a fresh browser measurement after implementation.

## Downstream boundaries

UI-04 is incomplete. SIM-03 behavior integration, ANA-03 destination analytics,
and INT-01 fair comparison are separate readiness gates. No changes to domain,
fixtures, simulation, analytics, app code, dependencies, or canonical metrics
are included. Continue on this branch only after documented gate resolution;
read installed Next.js guides before application/component edits. Re-audit this
checklist against current main and record actual evidence before completion.
