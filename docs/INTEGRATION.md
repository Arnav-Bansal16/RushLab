# Integration contracts and checkpoints

## State flow

1. Editor owns a serializable `Festival` draft in meters.
2. “Run” snapshots that draft and `SimulationSettings`; later editor changes do not mutate the active result.
3. `runSimulation` initializes deterministic profiles and stable attendee
   intents, then emits destination/vendor events plus sparse frames.
4. Analytics derives canonical vendor and destination metrics from events and
   returns `SimulationResult`.
5. Playback reads frames. Dashboard reads metrics. Neither mutates the result.
6. An alternative layout reuses baseline settings and attendee profiles.
7. `compareScenarios` validates compatibility before calculating deltas.
8. Analytics derives a deterministic issues report from canonical metrics.
9. Recommendations generate a small bounded set of legal festival candidates.
10. Candidate evaluation reuses the same comparison guard and returns an
    editable best-tested candidate with raw before/after evidence.
11. Optional AI receives only a compact structured
    comparison/issues/recommendation payload.

## Contract rules

- All public domain objects are JSON-serializable; no class instances, functions, `Date`, `Map`, or circular references.
- IDs are stable strings and arrays use deterministic ID ordering where order affects behavior.
- Festival entity IDs are unique across the document. Attendee and vendor IDs are unique within each result collection or frame where they identify an entity.
- `Point` positions and `Size` dimensions are world-space meters. The origin is the festival bounds origin, coordinates are finite and within `boundsMeters`, and the renderer transform is presentation-only.
- Simulation timestamps are seconds from run start.
- Currency is display units for P0; if real payments/reporting are added, migrate to integer minor units.
- Behavior weights are finite non-negative relative tendencies, not guaranteed
  visit percentages. Missing destination types are removed before weights are
  normalized; no eligible destination produces a safe exit.
- P0 itineraries default to at most four destinations and are configurable from
  one through six. Vendor, stage, and amenity stop limits each default to two
  and are configurable from zero through the overall maximum. The total always
  wins. `maximumVisitsPerDestination` defaults to one; a higher value explicitly
  enables bounded revisits. Immediate duplicate destinations are forbidden.
- Vendors are the only queued/service destinations; stage, restroom, seating,
  and first aid use deterministic dwell intervals. Missing types are removed
  before eligible-choice weights are renormalized.
- Each vendor visit permits at most one purchase. An attendee may purchase from
  multiple distinct vendors within the configured limits. Affordability is
  checked against remaining budget before each selection; completion deducts
  `vendor.averagePrice` exactly once and emits remaining budget and inventory.
- Global dwell defaults live in the settings snapshot; optional per-location
  dwell overrides live in the festival snapshot. The engine resolves them once
  and emits events/frames; UI and analytics must not re-resolve them.
- Queue tolerance is attendee base tolerance multiplied by the global settings
  multiplier. There is no per-vendor tolerance override in P0.
- CON-02 keeps `schemaVersion: 1` with backwards-compatible additive inputs:
  missing `Festival.amenities` means an empty list and missing behavior settings
  resolve to the documented defaults. Every new result snapshots fully resolved
  settings and complete attendee profiles. Unknown schema versions still fail.
- Each attendee profile is immutable and contains a stable choice-stream key,
  seeded individual intent,
  destination/vendor-category weights, price sensitivity, queue tolerance,
  movement variation, stage/exploration/amenity/dwell/exit tendencies,
  visit-duration tolerance, and initial budget. Runtime remaining budget is
  state/event data and never mutates the profile.
- Frames expose generic targets and travel/dwell/queue/exit state for modeled
  human-like playback. Canonical visit, transition, exit, budget, inventory,
  and business metrics remain event-derived.
- Layout findings and candidate scores are analytics outputs, not UI
  calculations. Every finding carries its threshold and canonical metric
  evidence; every candidate retains the raw comparison deltas used to rank it.
- P0 candidate generation changes only named vendor placement/capacity fields,
  returns complete immutable `Festival` snapshots, uses deterministic bounded
  enumeration or named streams, and preserves all non-targeted inputs.
- `best-tested candidate` means best within the documented candidate/seed set.
  It is never described as a global optimum or forecast.
- Physical crowd-flow, collision, and walkway-capacity bottlenecks are not
  canonical P0 findings. Any spatial hotspot is a visibly limited heuristic.

## Shared fixtures

- `demoFestival` is the reviewed baseline layout.
- `demoSimulationResult` is coherent illustrative modeled output for that layout; it is not a forecast or benchmark.
- `multiDestinationFestival`, `multiDestinationSimulationResult`, and its
  compatible alternative demonstrate bounded multiple vendors/stages, an
  intervening amenity, price-sensitive rejection, budget deduction, early exit,
  and exact profile reuse. They are contract examples, not forecasts.
- Every shared fixture must satisfy its public TypeScript contract, use unique IDs in the scopes above, and round-trip through `JSON.stringify`/`JSON.parse` without data loss.

## Fair comparison guard

Baseline and alternative must match on seed, attendee IDs and complete profiles,
initial budgets, spawn times, stable intent assignments, applicable choice
streams, duration, fixed step, walking speed, intent/destination/category
weights, price elasticity, queue-tolerance multiplier, overall/per-type/revisit
limits, exit settings, dwell/roam ranges, per-location dwell overrides, and
other non-layout demand assumptions.
A mismatch must either reject comparison or populate
`ScenarioComparison.compatibility.warnings`; it must never silently present a
fair-looking delta.

INT-01 snapshots the exact `Festival` input and explicit `modelSemantics` on
every `SimulationResult`. The semantics marker names bounded itinerary,
queue-departure reselection, full-queue reselection, frustration-marker and
modeled missed-sale-opportunity policies. A missing/unsupported snapshot,
schema or semantics marker is a hard incompatibility. `frameIntervalSeconds`
is presentation-only and is intentionally excluded from fair-comparison checks.

`assessScenarioCompatibility` is the reusable guard for manual and generated
alternatives. Hard incompatibilities return `ScenarioComparison` with all four
outcome groups set to `null`; consumers must not score or render those runs as
a fair comparison. One-sided entities and missing legacy optional missed-sale
metrics remain compatible with structured warnings and unavailable raw values.
Every available metric retains baseline, alternative, absolute
`alternative - baseline`, and percentage values. A zero baseline percentage is
`not_applicable`; a missing optional value is `unavailable`, never zero.
Duplicate canonical result identities are a hard incompatibility. ANA-03
transition arrays are sparse, so a transition row absent on one side has a raw
count of zero while retaining explicit one-sided presence and a warning.

Generated-candidate evaluation applies this guard independently for every
baseline/candidate pair. P0 evaluates no more than four candidates with a
documented three-seed suite derived deterministically from the requested
baseline seed. Each candidate is paired with the corresponding baseline for
each seed, per-seed comparisons are retained, and aggregation makes no
confidence-interval claim. Percentage deltas with a zero baseline denominator
are explicitly not applicable.

## Event-to-metric ownership

| Metric               | Canonical events/state                               |
| -------------------- | ---------------------------------------------------- |
| purchases / revenue  | `purchase`                                           |
| abandonment and wait | `queue_join` + `queue_abandon`                       |
| completed wait       | `queue_join` + `service_start`                       |
| maximum queue        | ordered queue transitions                            |
| stockout time        | first `stockout`                                     |
| utilization          | service intervals divided by server-time capacity    |
| stage/amenity visits | destination visit events                             |
| stage/amenity dwell  | matched dwell start/end or run-end truncation events |
| unique/repeat visits | ordered destination start events                     |
| type transitions     | consecutive visit order per attendee                 |
| exits / reasons      | typed `exit` events                                  |
| remaining budget     | ordered `purchase` and `exit` events                 |
| inventory            | ordered `purchase` / `stockout` events               |

Tests must reconcile aggregates with the event ledger.

## Vertical integration sequence

- CP1: UI renders the shared `Festival`; engine test accepts the same object.
- CP2: one attendee's spawn → movement → queue → purchase appears in events and a frame.
- CP2B: behavior/destination contracts, defaults, fixtures, and compatibility
  rules receive joint approval before implementation branches begin.
- CP3: 250 attendees produce playback and vendor charts from one real result.
- CP3B: the same load produces deterministic stage/vendor/roam/amenity behavior
  plus event-reconciled destination summaries.
- CP4: move or reprice one vendor, rerun with common profiles, intents, and
  settings, then compare; generate an issues report and a bounded set of legal
  candidates; identify an editable best-tested candidate with auditable raw
  deltas.
- CP5: run the exact demo script against a Vercel preview.

If a contract must change after CP1, open a small contract PR first, update fixtures/tests, get both humans to review, merge, then rebase dependent branches.

## UI-04 and queue-retention integration checkpoint (merged 2026-11-14)

Main `785ed94` includes PR #10/#11. See UI-04-CONSOLIDATED-HANDOFF.md for the
full current boundary, scope extension and evidence.

- Long/full queue departures reselect within normal bounds. Frames may carry
  queueFrustration; vendor frames may carry queueFull. UI must not reconstruct
  these states by guessing from events or browser time.
- missed_sale events value modeled opportunities at average vendor price;
  analytics supplies vendorMetrics.missedSales count/value. They are attempts,
  not unique guests or actual lost festival revenue. Stockout-only departure
  and ordinary exits are not assigned invented purchase amounts.
- Analytics reduces ordered events into recorded-moment vendor business values
  (cumulativeRevenue, cumulativeMissedSales, cumulativeMissedSaleValue). Playback
  reads these directly, resets on restart/rerun, and filters future ledger
  entries from display. Missing legacy values are Unavailable, not final totals.
- A future UI-03 dashboard reads final result metrics, independently of scrubbing.
  Do not reuse playback-time values as final-run summary metrics.
- ANA-03 now populates destination arrays in the current worktree; see
  [ANA-03 handoff](./ANA-03-HANDOFF.md). INT-01 must reject or
  visibly warn on incompatible model semantics as well as mismatched inputs;
  schemaVersion 1 alone cannot equate older timeout-exits runs with current runs.
- Fresh performance and remaining manual QA are pending, not proven by merge
  presence or historical test counts. Continue via UI-04-QA/PERF-01 in TASKS.

### Demonstration retention extension — pending joint review before merge

Optional `behavior.retainAttendeesUntilEnd` defaults to false. The festival demo
sets it true. It retains attendees on site until the global run end after their
bounded activity finishes and retains actual queue-departure markers until
closing. Frames expose optional `stayingUntilEnd` for idle-on-site guests;
this does not create a destination visit or queue. UI reads the engine marker
and labels this modeled demonstration assumption. All retained guests emit
run_ended exits at closing, with queue/service cleanup and zero red count then.

The existing compatibility guard compares the complete saved behavior object;
true-vs-false retention settings are incompatible. The setting is explicit
alongside existing model semantics, not a hidden change to all schema-v1 runs.
Missing legacy optional business metrics stay unavailable; no values are
fabricated to increase the visible frustration count.
