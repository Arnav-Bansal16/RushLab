# Dependency-aware backlog

Estimates are focused implementation time with AI assistance, not calendar guarantees. A = product/UI, B = simulation/analytics, J = joint.

## Current checkpoint — 2026-11-14

Fetched main `785ed94` includes UI-04/demo PR #10 (`b044aab`) and queue-retention
PR #11. SIM-03 and its handoff were already merged (#8/#9). See
[UI-04 consolidated handoff](./UI-04-CONSOLIDATED-HANDOFF.md) for delivered
behavior, scope deviations, exact contracts, evidence and continuation guidance.
Merge presence is verified; review-list APIs do not independently establish
both-developer approval. Do not treat old draft-status handoffs as current gates.

| Work | Current state | Remaining work |
| --- | --- | --- |
| SIM-02 / UI-02 / ANA-01 / CON-02 / SIM-03 | merged baseline | preserve invariants during later integration |
| UI-04 controls and SIM-03 integration | implementation merged in #10 | UI-04-QA and PERF-01 acceptance below |
| EXT-01 queue retention / missed sales / playback business snapshots | implemented and merged in #11 | preserve semantics; no duplicate implementation task |
| ANA-03 destination analytics | committed on `codex/ana-03-destination-metrics` | merge/integrate without reopening its formulas |
| UI-03 full results dashboard | not implemented | consume final result, not selected-frame demo values |
| INT-01 / ANA-02 / REL-01 | not implemented | follow dependencies and release checks |

Next feature path: `ANA-03 merge → INT-01 → ANA-02 → UI-03 → REL-01`.
UI-04-QA and PERF-01 run alongside feature work and must close before release.
The original graph/estimates below describe dependencies, not remaining effort
or a claim that already merged tasks need rebuilding.

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

SIM-03 + UI-04 + ANA-03 ─> INT-01 scenario comparison [J]
ANA-01 + ANA-03 + INT-01 -> ANA-02 issues + bounded candidate layouts [B, A reviews]
ANA-01 + ANA-03 + ANA-02 -> UI-03 dashboard + issues report [A]
UI-02 + UI-03 + INT-01 + ANA-02 -> REL-01 demo hardening/deploy [J]
```

Revised implementation critical path: `CON-01 → SIM-01 → SIM-02 → ANA-01 → CON-02 → SIM-03 → ANA-03 → INT-01 → ANA-02 → UI-03 → REL-01`.

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
  `docs/INTEGRATION.md`, `docs/TESTING.md`, and this authorized task update.
- **Dependencies / inputs:** Green SIM-02/UI-02/ANA-01 vertical slice and the
  approved P0 behavior rules in `docs/ARCHITECTURE.md`.
- **Output:** Serializable contracts for simulation-aware amenities, behavior
  settings, stable attendee intent, generic playback targets/visits, and
  destination metrics while preserving the public `RunSimulation` signature.
  Include the exact defaults, overall/per-type/revisit limits, individual
  profile parameters, type-level dwell ranges, per-location dwell overrides,
  effective queue-tolerance rule, multi-vendor budget semantics, typed exits,
  and generic visit events from `docs/ARCHITECTURE.md`.
- **Acceptance:** existing fixtures migrate cleanly; defaults reproduce a
  valid run; schema-version/backwards-compatibility treatment is explicit; all
  IDs/weights/ranges validate; JSON round-trip passes; both developers approve
  before dependent coding begins.
- **Tests:** contract validation, defaults, zero/missing destinations, and JSON
  round-trip; bounded fixture visits, purchases/budgets/inventory, price factor,
  early exit, profile reuse, determinism, stream independence, and comparison
  compatibility.
- **Effort:** 2.5–4 hours.
- **Checkpoint:** CP2B behavior contract freeze.

### SIM-03 — bounded attendee behavior and price elasticity

- **Owner / agent:** Developer B; simulation engineer.
- **Files:** `src/simulation/behavior/**`, necessary narrow composition in
  `src/simulation/runSimulation.ts`, and adjacent tests.
- **Dependencies / inputs:** CON-02, SIM-02, and the exact defaults/formula in
  `docs/ARCHITECTURE.md`.
- **Output:** Stable stage-first, vendor-first, explorer, and amenity-first
  intents; bounded one-to-six-stop itineraries with default four and default
  per-type maximum two; stage/amenity dwell; one or two seeded roaming
  waypoints; affordable price-sensitive vendor choice; distinct destinations
  by default; destination visit events; resolved dwell intervals; budget
  deduction across multiple vendor purchases; and typed safe exit fallbacks.
- **Acceptance:** no unbounded roaming; vendors above remaining budget are
  never selected; price changes can change modeled demand; stage and amenity
  destinations receive visits; vendors remain the only P0 queues; existing
  queue/inventory/event invariants remain green; no immediate duplicate
  destinations, recursion, unbounded roaming, or `Math.random()`.
- **Tests:** intent mix/defaults, price sensitivity, unaffordable vendors,
  post-purchase budget, stage attraction, default and overridden dwell ranges,
  queue-tolerance multiplier boundaries, bounds, overall/per-type/revisit
  limits, multiple purchases and exact remaining budget, multiple-stage
  eligibility, early exits, missing destination types, same-seed equality,
  stream independence, comparison compatibility, and all SIM-02 conservation
  tests.
- **Effort:** 5–8 hours.
- **Checkpoint:** CP3B behavior slice.

### ANA-03 — destination visit and dwell metrics

**Continuation:** consume the current merged destination ledger. Queue retention
and missed-sale events already exist; do not rebuild them here. Existing vendor
reducers remain authoritative. Full result destination arrays are currently empty.

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

**Status:** implementation merged in #10; current consolidated behavior includes
subsequent demo presentation changes in #11. The original frontend scope below
is preserved; cross-layer deviations are tracked explicitly as EXT-01. Manual
and performance acceptance remain under UI-04-QA/PERF-01, not marked complete.

- **Owner / agent:** Developer A; frontend engineer.
- **Files:** `src/features/editor/**`, a focused simulation-settings feature,
  playback presentation, and narrow app composition.
- **Dependencies / inputs:** CON-02; may proceed in parallel with SIM-03 after
  the contract merges.
- **Output:** Vendor `averagePrice` and `serviceTimeSeconds` creation/editing,
  plus advanced controls for intent/destination weights, overall/per-type and
  bounded-revisit maximum stops,
  type-level dwell/roaming ranges, optional per-stage/per-amenity dwell
  overrides, queue-tolerance multiplier, and global price elasticity. Playback
  renders generic targets/dwelling from frames without calculating behavior.
- **Acceptance:** accessible labels; finite non-negative weights/prices;
  documented safe handling when all eligible weights are zero; active run uses
  immutable festival/settings snapshots; visible “modeled assumptions” copy.
- **Tests:** form validation, immutable snapshot handoff, default settings,
  changed-price/service/dwell handoff, inheritance versus per-location override,
  min/max and numeric-limit validation, all-zero-weight handling, and playback
  boundary tests.
- **Effort:** 3–5 hours.
- **Checkpoint:** CP3B behavior slice.

## Explicit scope extension and acceptance follow-up

### EXT-01 — queue retention and playback-paced business statistics

- **Status:** implemented and merged in #11, not a new coding backlog item.
- **Scope change:** user requests expanded original UI-04 beyond controls into
  engine behavior, shared output contracts and analytics. A owns presentation;
  B owns engine/analytics; shared contract changes are joint-owned under AGENTS.
- **Delivered:** long/full queue departure re-enters bounded destination choice;
  engine-provided 15-second frustration marker and queueFull; missed_sale event
  valued at average vendor price; analytics missedSales counts/value; event-derived
  cumulative business values on frames; synchronized restart/rerun/scrub display.
- **Semantics:** normal visit/time/budget limits still apply. Modeled missed sales
  count attempts, not unique people, and are not actual lost festival revenue.
  Service/dwell still exist despite simplified presentation categories.
- **Evidence:** latest implementation `3fa38f2`: verify passed 182 tests, lint,
  types and build. Main tracked tree matches that implementation. Browser checks
  demonstrated full queues, current frustrated count, zero resets and timed values.
- **Next changes:** use a separate explicitly scoped behavior/analytics task and
  joint review for new shared fields; do not hide those changes in ANA-03/UI-03.

### UI-04-QA — close remaining manual acceptance

- **Owner:** A, joint review for cross-layer findings.
- **Inputs:** merged UI-04 + EXT-01 and consolidated handoff.
- **Work:** full keyboard/field-error audit, vendor creation, stage/amenity
  assumptions, complete amenity move/resize/delete/undo/export lifecycle,
  missing-type smoke, narrow statistics/ledger layout, prior-run/warning cases.
- **Acceptance:** record browser/device, performed steps and outcomes; confirm
  restart/rerun zeroes business figures, pause freezes them and scrub uses matching
  timestamps without altering final result metrics. No unverified item marked done.
- **Status:** pending; automated coverage and earlier smoke checks are evidence,
  not completion of every manual flow. Performance measurement is PERF-01.

## Remaining backlog

ANA-03 is committed on its feature branch. The requirements below consume its
event-derived destination metrics and do not reopen its formulas or ownership.

| ID      | Description                                | Owner / agent            | Files owned                                        | Depends on                    | Output and acceptance                                                                                                                                         | Effort | Checkpoint     |
| ------- | ------------------------------------------ | ------------------------ | -------------------------------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | -----: | -------------- |
| INT-01  | Baseline vs alternative                    | J / integration reviewer | narrow composition + `src/analytics/comparison/**` | SIM-03, UI-04, ANA-01, ANA-03 | Common profiles, seed, duration, demand, behavior and model semantics; incompatible inputs reject or warn; safe absolute and percent deltas                  |   4–5h | CP4 comparison |
| ANA-02  | Issues report + bounded candidate layouts  | B, A UX review           | `src/analytics/recommendations/**`                 | ANA-01, ANA-03, INT-01        | Deterministic evidence-backed findings; legal editable candidate festivals; bounded paired evaluation; best-tested candidate with raw before/after statistics |   6–9h | CP4 optimize   |
| UI-03   | Metrics dashboard and layout issues report | A / frontend engineer    | `src/features/dashboard/**`                        | ANA-01, ANA-03, ANA-02        | Final-result views use ActiveRun snapshots; render issue evidence/actions, candidate changes and deltas; no canonical UI math                                |   4–6h | CP4 report     |
| PERF-01 | 300-agent and candidate-search budget      | B engine, A renderer     | tests/scripts only                                 | CP4                           | Single-run target measured; bounded search count/runtime and frame payload documented; no unexplained O(n²) behavior                                          |   2–3h | feature freeze |
| REL-01  | Demo hardening and Vercel preview          | J / integration reviewer | config, docs, smoke tests                          | all P0 + UI-04-QA + PERF-01   | `npm run verify`; preview generates an issues report and editable best-tested candidate without signup; demo script succeeds                                  |   4–5h | CP5 release    |
| P1-CSV  | Validated CSV import                       | A                        | new import feature                                 | P0 deployed                   | Explicit column mapping/errors; no silent coercion                                                                                                            |     3h | optional       |
| P1-AI   | Explain structured comparison              | A                        | server route + explanation UI                      | P0 deployed, API approval     | No raw secrets/client key; calculations unchanged; graceful no-key mode                                                                                       |   3–4h | optional       |

### INT-01 comparison requirements

INT-01 remains the canonical comparison primitive for manually edited and
ANA-02-generated alternatives. It must:

- begin with a small joint review for additive destination-delta and
  zero-denominator representations needed in shared comparison contracts;
- compare immutable baseline and alternative festival/settings/result
  snapshots without mutating either run;
- preserve EXT-01 queue-retention and missed-sale semantics when checking model
  compatibility;
- enforce the fair-comparison guard for seed, attendee profiles, choice-stream
  inputs, duration, demand, and every behavior assumption;
- report absolute deltas and percentages for vendor and destination outcomes,
  with `not applicable` when a percentage denominator is zero;
- preserve raw metrics alongside any score or summary; and
- describe every delta as a modeled result, never a forecast.

### ANA-02 issues and candidate-layout requirements

ANA-02 expands the existing placement/capacity recommendation task rather than
adding an unbounded optimizer. Begin with a small joint review of additions
needed to shared issue, candidate and evaluation result contracts; do not hide
public shapes inside UI code.

The issues report deterministically identifies supported operational issues:

- excessive vendor wait, peak queue, abandonment, utilization, stockout, queue
  frustration, or modeled missed-sale attempts;
- underused or overloaded vendors and destinations using ANA-01/ANA-03 metrics;
- uneven visit/dwell patterns or weak destination transitions when supported by
  explicit thresholds; and
- invalid or impossible placement recommendations.

Every finding includes a stable ID, category, severity, affected entity IDs,
metric evidence, threshold, concise rationale, suggested action, and applicable
model limitation. P0 may label spatial evidence as a `potential congestion
area`, but it must not claim scientifically validated walkway, collision, or
crowd-flow bottlenecks because those are not modeled.

Candidate generation and evaluation must:

- produce at most four valid `Festival` snapshots per P0 search by moving
  vendors and, when recommended, changing supported vendor capacity;
- preserve stages, entrances, paths, amenities, prices, demand assumptions and
  every field not named by the recommendation;
- keep geometry in bounds and outside obstacles, avoid illegal overlaps, and
  return candidates as editable festival data;
- use deterministic candidate ordering and no `Math.random()`;
- evaluate every candidate against its baseline through INT-01 with compatible
  paired inputs and a documented three-seed suite derived deterministically
  from the requested baseline seed;
- retain per-seed results without making a statistical-confidence claim;
- use a visible documented objective balancing queue/wait, abandonment,
  stockout, throughput/revenue, destination use, frustration, and modeled
  missed-sale evidence rather than hiding a revenue-only score;
- retain raw absolute and percentage deltas so ranking is auditable; and
- call the result the `best-tested candidate` or `optimized candidate`, never a
  globally optimal layout.

Tests cover stable issue IDs/order, evidence/threshold reconciliation, empty
and zero-demand layouts, legal placement, the four-candidate cap, deterministic
generation/ranking, input immutability, zero-denominator deltas, identical
paired assumptions, rejected incompatible model semantics, and a fixture where
the best-tested candidate improves its documented objective without requiring
every individual metric to improve.

## Parallelism

- After CP1, UI-01 and SIM-01/SIM-02 run in parallel.
- CON-02 is serial joint work. After it merges, SIM-03 and UI-04 may run in
  parallel because they own disjoint files.
- ANA-03 starts after SIM-03 fixes the destination event ledger. UI-03 may use
  the reviewed result fixture while ANA-03 is built.
- After ANA-03, finish INT-01 before ANA-02 so every generated candidate uses
  the same fair-comparison rules as a manually edited alternative.
- UI-03 may build its base metric views while ANA-02 is underway, but the
  issues/candidate report integration waits for ANA-02's reviewed result shape.
- Do not parallelize contract changes, comparison compatibility rules, or release integration.
- Do not let agents concurrently edit `src/domain`, shared fixtures, package files, or the same route.

## Integration checkpoints

1. **CP1 Contract freeze:** fixtures serialize; types/docs reviewed; main green.
2. **CP2 Vertical slice:** one attendee completes an observable purchase path.
3. **CP2B Behavior contract:** destination/settings/events fixture is jointly approved.
4. **CP3 Load slice:** 200–300 attendee simulation, playback, and vendor metrics integrate.
5. **CP3B Behavior slice:** price-sensitive intent mix visibly visits stages, vendors, roaming waypoints, and supported amenities; destination metrics reconcile.
6. **CP4 Comparison and report slice:** a manual alternative and a bounded set
   of generated candidates use identical modeled assumptions; the UI explains
   issues, shows evidence, and identifies a best-tested editable candidate with
   auditable before/after statistics.
7. **CP5 Feature freeze:** P0 preview deployed; only fixes/polish.

## Time and risk budget

The behavior expansion adds approximately 12–20 focused person-hours across two
developers. Protect the weekend scope with a default four-stop limit (hard
configurable maximum six), per-type caps, no revisits by default, nonvendor
amenities that remain unqueued, and bounded seeded waypoints instead of free
random walks. Highest risks are contract churn, frame payload/rendering, unfair
comparisons, and candidate-search runtime; mitigate with CON-02, 1 Hz frames,
named streams, shared profiles/intents/preferences/budgets, a four-candidate
cap, and the documented three-seed suite.

## Downstream integration notes

- UI-03 shows final result.vendorMetrics/result.totals and ANA-03 outputs. The
  demo's selected-frame revenue table is not a full dashboard and must not
  replace final-result reporting. Both can coexist, clearly labeled.
- INT-01 must account for optional frustration/missed-sale/timed-frame outputs
  and behavioral compatibility: old timeout-exits runs differ from current
  timeout-reselects runs even if both use schemaVersion 1. Select a visible
  warning/rejection or separately reviewed versioning approach in that task.
- PERF-01 must measure current 300-guest rendering, synchronous engine time and
  payload including new per-frame business/frustration data. FPS is unknown;
  do not reuse old measurements as evidence.
- REL-01 depends on a complete end-to-end demo: edit assumptions → run → inspect
  timed playback and final results → compare compatible scenarios → show
  evidence-backed recommendations. Deploy only after required checks pass.
