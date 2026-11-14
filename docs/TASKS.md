# Dependency-aware backlog

Estimates are focused implementation time with AI assistance, not calendar guarantees. A = product/UI, B = simulation/analytics, J = joint.

## Dependency graph and critical path

```text
SET-01 scaffold (done)
  └─> CON-01 contracts + fixture + seed policy [J]
       ├─> UI-01 static/editable map [A]
       └─> SIM-01 seeded engine skeleton [B]
            └─> SIM-02 queue/purchase/events [B]
                 └─> ANA-01 metrics/results [B]
UI-01 + SIM-01 ──> UI-02 playback integration [A]

SIM-02 + UI-02 + ANA-01
  └─> CON-02 behavior/destination contract [J]
       ├─> SIM-03 intent, price, stage, roam, amenity behavior [B]
       │    └─> ANA-03 destination visit/dwell metrics [B]
       └─> UI-04 vendor price + advanced behavior controls [A]

ANA-01 + ANA-03 ─> UI-03 dashboard [A]
SIM-03 + UI-04 + ANA-03 ─> INT-01 scenario comparison [J]
ANA-01 + INT-01 -> ANA-02 recommendations [B, A reviews]
UI-02 + UI-03 + INT-01 + ANA-02 -> REL-01 demo hardening/deploy [J]
```

Critical path: `CON-01 → SIM-01 → SIM-02 → ANA-01 → CON-02 → SIM-03 → ANA-03 → INT-01 → REL-01`.

## First five coding tasks

### CON-01 — freeze v1 contracts and fixtures

- **Owner / agent:** Joint; integration reviewer.
- **Files:** `src/domain/**`, `src/fixtures/**`, `docs/ARCHITECTURE.md`, `docs/INTEGRATION.md` only.
- **Dependencies / inputs:** Approved architecture; current interface draft.
- **Output:** Reviewed `Festival`, `Vendor`, `Attendee`, settings/frame/result/metrics/comparison/recommendation types; baseline fixture; result fixture; seed/units rules.
- **Acceptance:** strict typecheck; IDs unique; coordinates explicitly meters; fixtures serialize to JSON; both developers approve; no React imports.
- **Tests:** contract fixture test and JSON round-trip.
- **Effort:** 1–1.5 hours.
- **Checkpoint:** CP1 Contract freeze. Merge before parallel implementation.

### UI-01 — static map and vendor editing vertical slice

- **Owner / agent:** Developer A; frontend engineer.
- **Files:** `src/features/editor/**`, `src/components/**`, `src/app/**`; do not change `src/domain/**` without a separate PR.
- **Dependencies / inputs:** CON-01 and `demoFestival`.
- **Output:** Client-side Konva map with meter→pixel transform, stages/entrance/paths/vendors, drag-within-bounds, one vendor attribute form.
- **Acceptance:** dragging updates a copied `Festival`; viewport resize does not change world coordinates; no simulation logic; keyboard/form labels are usable.
- **Tests:** transform/bounds unit tests; manual 1280×720 demo smoke.
- **Effort:** 3–4 hours.
- **Checkpoint:** demo fixture renders and exports valid festival JSON.

### SIM-01 — seeded profiles and engine skeleton

- **Owner / agent:** Developer B; simulation engineer.
- **Files:** `src/simulation/**` and tests.
- **Dependencies / inputs:** CON-01, `pure-rand`, demo fixture.
- **Output:** named RNG streams, attendee profile factory, fixed-step loop, placeholder movement to valid waypoints, concrete `runSimulation` export.
- **Acceptance:** no `Math.random`; 250 attendees spawn deterministically; identical input yields identical profiles/events/frames; changing movement draws does not change profile stream.
- **Tests:** same-seed equality, different-seed inequality, named-stream independence, bounds/time monotonicity.
- **Effort:** 3–4 hours.
- **Checkpoint:** CP2 one-attendee vertical slice contract consumed by a fixture/test.

### SIM-02 — queue, service, purchase, abandonment, inventory

- **Owner / agent:** Developer B; simulation engineer.
- **Files:** `src/simulation/queue/**`, `src/simulation/events/**`, adjacent tests.
- **Dependencies / inputs:** SIM-01, `Vendor` capacity fields, event union.
- **Output:** FIFO queues, server slots, service completion, purchase and stockout events, timeout abandonment, stable simultaneous-event order.
- **Acceptance:** no attendee served twice; queue/server counts never negative; inventory never below zero; stockout blocks purchase; capacity changes throughput; every service request terminates in purchase or abandonment by run end/exit.
- **Tests:** conservation, FIFO, capacity 1 vs 2, stockout, queue limit, abandonment boundary, deterministic tie-break.
- **Effort:** 4–5 hours.
- **Checkpoint:** CP2 end-to-end attendee enters, queues, purchases, and produces events.

### UI-02 — frame playback integration

- **Owner / agent:** Developer A; frontend engineer.
- **Files:** `src/features/playback/**`, editor composition only.
- **Dependencies / inputs:** UI-01, SIM-01 frame fixture/signature.
- **Output:** play/pause/scrub/speed controls and attendee/vendor frame rendering without altering engine state.
- **Acceptance:** consumes only `SimulationFrame[]`; handles empty/final frames; 300 attendee circles maintain target 30+ FPS on the demo laptop; results remain usable if animation is paused.
- **Tests:** frame cursor boundary unit tests; manual performance measurement recorded in PR.
- **Effort:** 3–4 hours.
- **Checkpoint:** CP3 integrated playback at target load.

## P0 behavior expansion

Complete and merge SIM-02, UI-02, and ANA-01 before starting this expansion.
Do not hide behavior or contract work inside those existing task branches.

### CON-02 — behavior and destination contract

- **Owner / agent:** Joint; integration reviewer.
- **Files:** `src/domain/**`, `src/fixtures/**`, `docs/ARCHITECTURE.md`,
  `docs/INTEGRATION.md`, `docs/TESTING.md` only.
- **Dependencies / inputs:** Green SIM-02/UI-02/ANA-01 vertical slice and the
  approved P0 behavior rules in `docs/ARCHITECTURE.md`.
- **Output:** Serializable contracts for simulation-aware amenities, behavior
  settings, stable attendee intent, generic playback targets/visits, and
  destination metrics while preserving the public `RunSimulation` signature.
- **Acceptance:** existing fixtures migrate cleanly; defaults reproduce a
  valid run; schema-version/backwards-compatibility treatment is explicit; all
  IDs/weights/ranges validate; JSON round-trip passes; both developers approve
  before dependent coding begins.
- **Tests:** contract validation, defaults, zero/missing destinations, and JSON
  round-trip.
- **Effort:** 1.5–2.5 hours.
- **Checkpoint:** CP2B behavior contract freeze.

### SIM-03 — bounded attendee behavior and price elasticity

- **Owner / agent:** Developer B; simulation engineer.
- **Files:** `src/simulation/behavior/**`, necessary narrow composition in
  `src/simulation/runSimulation.ts`, and adjacent tests.
- **Dependencies / inputs:** CON-02, SIM-02, and the exact defaults/formula in
  `docs/ARCHITECTURE.md`.
- **Output:** Stable stage-first, vendor-first, explorer, and amenity-first
  intents; at most three stops; stage/amenity dwell; one or two seeded roaming
  waypoints; affordable price-sensitive vendor choice; destination visit
  events; and safe exit fallback.
- **Acceptance:** no unbounded roaming; vendors above remaining budget are
  never selected; price changes can change modeled demand; stage and amenity
  destinations receive visits; vendors remain the only P0 queues; existing
  queue/inventory/event invariants remain green; no `Math.random()`.
- **Tests:** intent mix/defaults, price sensitivity, unaffordable vendors,
  stage attraction, bounds, maximum stops, missing destination types, same-seed
  equality, stream independence, and all SIM-02 conservation tests.
- **Effort:** 4–6 hours.
- **Checkpoint:** CP3B behavior slice.

### ANA-03 — destination visit and dwell metrics

- **Owner / agent:** Developer B; simulation engineer.
- **Files:** `src/analytics/destinations/**` and adjacent tests.
- **Dependencies / inputs:** SIM-03 event ledger and ANA-01 metric ownership
  pattern.
- **Output:** Event-derived visit and dwell summaries for stages and amenities;
  no frame-derived canonical values.
- **Acceptance:** every summary reconciles exactly with ordered events, includes
  zero-visit destinations in stable ID order, is deterministic/serializable,
  and does not duplicate ANA-01 vendor formulas.
- **Tests:** empty/zero visits, first/last dwell boundaries, run-end truncation,
  stable ordering, event reconciliation, input immutability, and same-seed
  equality.
- **Effort:** 1.5–2.5 hours.
- **Checkpoint:** CP3B behavior slice.

### UI-04 — vendor price and advanced behavior controls

- **Owner / agent:** Developer A; frontend engineer.
- **Files:** `src/features/editor/**`, a focused simulation-settings feature,
  playback presentation, and narrow app composition.
- **Dependencies / inputs:** CON-02; may proceed in parallel with SIM-03 after
  the contract merges.
- **Output:** Vendor `averagePrice` creation/editing plus advanced controls for
  intent/destination weights, maximum stops, dwell/roaming ranges,
  queue-tolerance multiplier, and global price elasticity. Playback renders
  generic targets/dwelling from frames without calculating behavior.
- **Acceptance:** accessible labels; finite non-negative weights/prices;
  documented safe handling when all eligible weights are zero; active run uses
  immutable festival/settings snapshots; visible “modeled assumptions” copy.
- **Tests:** form validation, immutable snapshot handoff, default settings,
  changed-price handoff, all-zero-weight handling, and playback boundary tests.
- **Effort:** 3–5 hours.
- **Checkpoint:** CP3B behavior slice.

## Remaining backlog

| ID      | Description                            | Owner / agent            | Files owned                                        | Depends on                    | Output and acceptance                                                                              | Effort | Checkpoint     |
| ------- | -------------------------------------- | ------------------------ | -------------------------------------------------- | ----------------------------- | -------------------------------------------------------------------------------------------------- | -----: | -------------- |
| ANA-01  | Derive metrics from event ledger       | B / simulation engineer  | `src/analytics/metrics/**`                         | SIM-02                        | Vendor/totals exactly reconcile with events; wait/queue/utilization tests                          |   2–3h | CP3 load slice |
| UI-03   | Metrics dashboard                      | A / frontend engineer    | `src/features/dashboard/**`                        | ANA-01, ANA-03                | Recharts views render missing/zero vendor and destination data and do no canonical math            |   2–3h | CP3B           |
| INT-01  | Baseline vs alternative                | J / integration reviewer | narrow composition + `src/analytics/comparison/**` | SIM-03, UI-04, ANA-01, ANA-03 | Same profiles, intent assignments, and behavior settings; incompatible inputs warn; visible deltas |     3h | CP4 comparison |
| ANA-02  | Placement/capacity rules               | B, A UX review           | `src/analytics/recommendations/**`                 | ANA-01, INT-01                | Legal candidate positions; evidence/threshold on every recommendation                              |     3h | CP4            |
| PERF-01 | 300-agent benchmark and payload budget | B engine, A renderer     | tests/scripts only                                 | CP3                           | Simulation <2s target; frame payload documented; no O(n²) surprise without note                    |   1–2h | feature freeze |
| REL-01  | Demo hardening and Vercel preview      | J / integration reviewer | config, docs, smoke tests                          | all P0                        | `npm run verify`; preview works without signup; demo script succeeds                               |   3–4h | CP5 release    |
| P1-CSV  | Validated CSV import                   | A                        | new import feature                                 | P0 deployed                   | Explicit column mapping/errors; no silent coercion                                                 |     3h | optional       |
| P1-AI   | Explain structured comparison          | A                        | server route + explanation UI                      | P0 deployed, API approval     | No raw secrets/client key; calculations unchanged; graceful no-key mode                            |   3–4h | optional       |

## Parallelism

- After CP1, UI-01 and SIM-01/SIM-02 run in parallel.
- CON-02 is serial joint work. After it merges, SIM-03 and UI-04 may run in
  parallel because they own disjoint files.
- ANA-03 starts after SIM-03 fixes the destination event ledger. UI-03 may use
  the reviewed result fixture while ANA-03 is built.
- Do not parallelize contract changes, comparison compatibility rules, or release integration.
- Do not let agents concurrently edit `src/domain`, shared fixtures, package files, or the same route.

## Integration checkpoints

1. **CP1 Contract freeze:** fixtures serialize; types/docs reviewed; main green.
2. **CP2 Vertical slice:** one attendee completes an observable purchase path.
3. **CP2B Behavior contract:** destination/settings/events fixture is jointly approved.
4. **CP3 Load slice:** 200–300 attendee simulation, playback, and vendor metrics integrate.
5. **CP3B Behavior slice:** price-sensitive intent mix visibly visits stages, vendors, roaming waypoints, and supported amenities; destination metrics reconcile.
6. **CP4 Comparison slice:** vendor move/price change yields fair deltas and evidence-backed suggestion under identical behavior assumptions.
7. **CP5 Feature freeze:** P0 preview deployed; only fixes/polish.

## Time and risk budget

The behavior expansion adds approximately 10–16 focused person-hours across two
developers. Protect the weekend scope by limiting attendees to three stops,
keeping nonvendor amenities unqueued, using bounded seeded waypoints instead of
free random walks, and exposing only the documented advanced settings. Highest
risks are contract churn, frame payload/rendering, and unfair comparisons;
mitigate with CON-02, 1 Hz frames, named streams, and shared profiles/intents.
