# Technical architecture

## Decision

Use Approach C: a small domain-specific TypeScript engine inside one Next.js application. Reuse focused MIT libraries for seeded randomness, 2D rendering, and charts. Do not fork a complete simulator and do not add a backend to P0.

## Dependency and data flow

```text
Editor (React + Konva) ──updates──> Festival contract
                                      │
                                      ▼
                        runSimulation(festival, settings)
                                      │
                 ┌────────────────────┼────────────────────┐
                 ▼                    ▼                    ▼
             event ledger        sparse frames       calculated metrics
                 │                    │                    │
                 └──────────> SimulationResult <───────────┘
                                      │
                    ┌─────────────────┼──────────────────┐
                    ▼                 ▼                  ▼
            Konva playback      Recharts dashboard   analytics rules
                                      │                  │
                                      └── comparison ────┤
                                                         ▼
                                            issues + bounded candidates
                                                         │
                                            optional P1 explanation
```

## Stack

| Dependency                         | Why it exists                                                                 | Not used for                    |
| ---------------------------------- | ----------------------------------------------------------------------------- | ------------------------------- |
| Next.js 16 + React 19 + TypeScript | One familiar app, static/client rendering, Vercel previews, strict contracts. | Simulation semantics.           |
| Konva + react-konva                | Canvas scene graph, drag/drop, zoom/pan, map layers, attendee circles.        | Pathfinding, queueing, metrics. |
| Recharts                           | Business charts and scenario deltas.                                          | Canonical calculations.         |
| pure-rand                          | Explicit seeded PRNG state and derived streams.                               | Business decisions by itself.   |
| Tailwind CSS                       | Fast, consistent shell styling.                                               | Component-system lock-in.       |
| Vitest                             | Fast engine/analytics contract tests.                                         | Full browser automation in P0.  |

Do not add Zustand, shadcn/ui, PixiJS, Supabase, Vercel AI SDK, Zod, Papa Parse, or a Web Worker until a specific P1 task justifies it.

## Folder boundaries

```text
src/
  app/                 Next.js routes and shell                     [Developer A]
  components/          generic UI                                  [Developer A]
  domain/              shared serializable contracts               [joint]
  fixtures/            reviewed shared examples                    [joint]
  features/
    editor/            Festival editing and meter/pixel transform  [Developer A]
    playback/          SimulationFrame rendering                   [Developer A]
    dashboard/         SimulationResult presentation               [Developer A]
  simulation/          deterministic engine; no React/DOM          [Developer B]
  analytics/           metrics, comparison, recommendations        [Developer B]
```

`src/domain/model.ts` and `src/domain/simulation.ts` contain the complete v1 interfaces. The stable callable boundary is:

```ts
type RunSimulation = (
  festival: Festival,
  settings: SimulationSettings,
) => SimulationResult;

type CompareScenarios = (
  baseline: SimulationResult,
  alternative: SimulationResult,
) => ScenarioComparison;

type RecommendPlacements = (
  festival: Festival,
  result: SimulationResult,
) => PlacementRecommendation[];
```

The concrete exports will be added in task SIM-01 without changing these signatures.

CP1 freezes these v1 contracts. `Point` and `Size` are world-space meters;
timestamps and durations are seconds from simulation start. The reviewed
`demoFestival` and `demoSimulationResult` fixtures are the shared integration
examples for UI, simulation, and analytics work. They are JSON documents and
must remain valid against the public contracts.

ANA-02 extends the analytics layer with serializable issue-report and candidate
evaluation shapes. Because those shapes cross analytics and UI ownership, they
receive a small joint contract review before implementation. The existing
`runSimulation`, `compareScenarios`, and `recommendPlacements` boundaries stay
valid; candidate generation composes them rather than moving simulation or
metric calculations into React.

## Layout issues and bounded candidate evaluation

The P0 issues report is a deterministic interpretation of canonical ANA-01 and
ANA-03 metrics. Each finding has a stable ID, category, severity, affected
entities, metric evidence, an explicit threshold, a suggested action, and a
model-limitation note. Supported findings include vendor wait/queue,
abandonment, utilization, stockout, underuse/overload, and uneven destination
visits or dwell. UI code renders these findings but does not recalculate them.

P0 does not model collision dynamics, walkway capacity, or calibrated crowd
density. It may report a `potential congestion area` only when the supporting
heuristic and limitation are visible. It must not present that label as a
validated physical bottleneck or safety forecast.

Candidate generation is deliberately bounded and deterministic:

1. derive evidence-backed placement or capacity actions from the baseline;
2. produce at most four legal `Festival` snapshots in stable order;
3. simulate the baseline and each candidate with paired seeds, identical
   profiles, duration, demand, and behavior assumptions;
4. compare each pair through the canonical comparison layer;
5. rank candidates with a visible documented objective while retaining all raw
   metric deltas; and
6. return the best-tested candidate as editable festival data.

P0 candidate mutations are limited to vendor placement and supported capacity
changes. They preserve stages, entrances, paths, amenities, prices, and all
non-layout demand assumptions unless the recommendation explicitly names the
field. Geometry remains in bounds, outside obstacles, and free of illegal
overlap. Generation uses deterministic enumeration or named seeded streams and
never `Math.random()`.

The evaluation reports absolute and percentage changes for the metrics it
uses. A zero baseline denominator is `not applicable`, not an infinite or
fabricated improvement. P0 ranking uses a documented three-seed suite derived
deterministically from the requested baseline seed. Baseline and candidate are
paired within each seed and per-seed evidence is retained; the aggregate is not
described as a statistical confidence interval. The product calls the output
an `optimized candidate` or `best-tested candidate`, never a globally optimal
layout.

## Engine model

P0 uses fixed time steps (start at 0.5 seconds) and records playback at a lower rate (start at 1 frame/second). An attendee utility can combine category preference, vendor popularity, price penalty, travel-time penalty, predicted wait penalty, and a small seeded exploration term.

Movement begins with predefined path segments/waypoints and interpolation. Collision science is explicitly out of scope. Queue/server state must be exact even if movement is visually simplified.

### P0 attendee behavior expansion

The initial vertical slice sends every attendee directly to one available
vendor. The completed P0 must instead support a small, bounded intent model.
The intent is an initial tendency, not a fixed two-stop script:

- `stage_first`: initially favors stages;
- `vendor_first`: initially favors affordable vendors;
- `explorer`: may take one or two seeded in-bounds waypoints before choosing;
- `amenity_first`: initially favors restroom, seating, or first aid.

An attendee may visit multiple destinations, bounded by the overall and
per-type limits below. The default overall maximum is four stops and the
configurable range is one through six. Stage and amenity visits use
deterministic dwell intervals. Vendors remain the only queued/service
destinations in P0; restrooms, seating, and first aid are nonqueued dwell
destinations. Gates and exits are routing points, paths are movement
infrastructure, obstacles constrain placement/movement, parking is visual
infrastructure, and custom objects are not simulation destinations unless a
later contract explicitly enables them.

Default intent weights are 40% stage-first, 35% vendor-first, 15% explorer,
and 10% amenity-first. Default destination-type weights are:

| Type                                        | Weight | P0 meaning                                                                                 |
| ------------------------------------------- | -----: | ------------------------------------------------------------------------------------------ |
| stage                                       |   1.00 | Multiplied by the stage's attraction.                                                      |
| vendor                                      |   0.85 | Further adjusted by category preference, popularity, affordability, and price sensitivity. |
| restroom                                    |   0.25 | Short nonqueued dwell visit.                                                               |
| seating                                     |   0.18 | Rest/dwell visit.                                                                          |
| first aid                                   |   0.02 | Rare modeled visit, never described as an incident forecast.                               |
| gate, exit, path, obstacle, parking, custom |   0.00 | Not selectable P0 destinations.                                                            |

Weights are relative modeled tendencies, not promised visit percentages. A
missing destination type is ignored and the remaining eligible weights are
normalized. If no eligible destination remains, the attendee exits.

For an affordable vendor, the minimum P0 choice formula is:

```text
priceFactor = exp(
  -settings.priceElasticity
  * attendee.priceSensitivity
  * vendor.averagePrice / max(attendee.remainingBudget, 0.01)
)

vendorUtility = settings.vendorWeight
  * attendee.vendorCategoryWeight
  * vendor.popularity
  * priceFactor
```

A vendor priced above the attendee's remaining budget is ineligible. The full
SIM-03 utility may additionally include destination preference, predicted wait,
travel time, novelty/repeat penalty, and a small seeded exploration term.
Price elasticity is applied independently each time a vendor is considered.
Purchase amount remains `vendor.averagePrice`. These are transparent modeled
assumptions, not elasticity or revenue forecasts.

Behavior assumptions belong in serializable simulation settings and are
snapshotted with every run. The editor may expose advanced controls for intent
weights, destination weights, maximum stops, dwell ranges, roaming waypoints,
queue-tolerance multiplier, and global price elasticity. UI code must not
calculate choices or metrics.

### P0 behavior parameter contract

CON-02 must encode the following defaults and validation rules. These values
are transparent demo assumptions, not empirically calibrated behavior.

| Parameter                         |                                 Default | Allowed P0 range / rule                                                    |
| --------------------------------- | --------------------------------------: | -------------------------------------------------------------------------- |
| maximum itinerary stops           |                                       4 | integer from 1 through 6                                                   |
| maximum vendor stops              |                                       2 | integer from 0 through maximum itinerary stops                             |
| maximum stage stops               |                                       2 | integer from 0 through maximum itinerary stops                             |
| maximum amenity stops             |                                       2 | integer from 0 through maximum itinerary stops                             |
| maximum visits per destination    |                                       1 | integer from 1 through maximum itinerary stops; values above 1 enable bounded revisits |
| roaming waypoints for an explorer |                                       1 | integer from 0 through 2                                                   |
| queue-tolerance multiplier        |                                     1.0 | finite value from 0 through 5                                              |
| global price elasticity           |                                     1.0 | finite value from 0 through 10                                             |
| seeded exit probability after stop|                                    0.08 | finite value from 0 through 1                                              |
| minimum remaining visit time      |                              30 seconds | finite value from 0 through 3,600 seconds                                  |
| any intent/destination weight     |                         as listed above | finite value from 0 through 10                                             |
| vendor average price              |         per vendor, existing default 12 | finite display-currency value from 0 through 10,000                        |
| vendor service time               | per vendor, existing default 75 seconds | finite value greater than 0 and at most 3,600 seconds                      |
| stage dwell                       |                          30–120 seconds | minimum/maximum each from 0 through 3,600; minimum must not exceed maximum |
| restroom dwell                    |                          45–120 seconds | same dwell-range validation                                                |
| seating dwell                     |                          30–180 seconds | same dwell-range validation                                                |
| first-aid dwell                   |                          60–300 seconds | same dwell-range validation                                                |

The type-level dwell ranges above are global defaults. Each stage or supported
amenity may optionally override its own minimum and maximum. A missing override
inherits the current type default. Per-location overrides are part of the
festival snapshot; global defaults are part of the settings snapshot. Playback
and analytics use the resolved engine output and must not resolve defaults
independently.

`AttendeeProfile.queueToleranceSeconds` remains the attendee's stable base
tolerance (currently generated from 30 through 300 seconds). Effective vendor
queue tolerance is:

```text
effectiveQueueTolerance = profile.queueToleranceSeconds
  * settings.queueToleranceMultiplier
```

P0 has no per-vendor tolerance override because vendors are the only queued
destination type and tolerance represents attendee patience. Stage and amenity
dwell is not queue waiting. ANA-01 continues to measure vendor wait from
`queue_join` to `service_start`; ANA-03 measures dwell from destination events.

Each vendor visit permits at most one purchase. An attendee may purchase from
multiple distinct vendors within the configured vendor-stop and overall-stop
limits. The engine checks affordability before every vendor selection, records
`vendor.averagePrice`, deducts it exactly once after a completed purchase, and
emits the resulting remaining budget and inventory. Immediate duplicate
destinations are forbidden. P0 does not revisit a physical destination unless
`maximumVisitsPerDestination` is explicitly configured above one; revisits
remain bounded by that value and the overall itinerary limit.

Every `AttendeeProfile` stores stable, serializable individual parameters:
choice-stream key, intent, destination-type and vendor-category weights, price sensitivity, queue
tolerance, walking-speed variation, stage attraction, exploration tendency,
amenity tendency, dwell-duration tendency, exit tendency, visit-duration
tolerance, and immutable initial budget. Global settings are population
defaults; profile generation applies deterministic seeded variation. All
individual weights are finite, non-negative, and at most 10. Runtime remaining
budget starts at `initialBudget`, changes only on completed purchases, and is
reported in purchase/exit events and frames rather than mutating the profile.

Baseline and alternative layouts reuse the exact attendee IDs, profiles,
weights, budgets, spawn times, intent assignments, and applicable choice-stream
inputs. A comparison must never generate fresh preferences.

### Modeled human-like movement and bounded exit

P0 describes this behavior as **modeled human-like movement**, never validated
real human behavior or a forecast. SIM-03 implements the bounded sequence:

```text
enter
→ choose from currently eligible destinations
→ travel through world-space waypoints
→ queue/service or dwell
→ update remaining budget, visited destinations, and elapsed visit time
→ choose another destination, roam, or exit
→ repeat until an exit condition or configured limit is reached
```

Selection may consider individual preferences, attraction/popularity, price
and remaining budget, predicted wait, travel distance/time, prior visits,
elapsed festival time, completed stops, and seeded exploration. Missing
destination types are removed and remaining eligible weights are renormalized.
Movement never teleports; frames carry generic target plus choosing, walking,
roaming, queueing, purchasing, dwelling, leaving, and exited state for playback.

An attendee exits when the itinerary limit is reached, no eligible destination
remains, remaining time is insufficient, budget blocks another desired
purchase, the deterministic seeded post-stop exit
decision succeeds, or the run ends. Exit decisions are seeded and bounded;
there is no recursive itinerary construction or endless free roaming.

Generic destination start/end events identify attendee, physical destination,
destination type, visit order, repeat status, duration, and truncation. Together
with typed exit reasons they support event-derived visits, unique visitors,
repeat visits when enabled, completed/truncated dwell, visit order, transitions,
and exits. Vendor queue/service/purchase events additionally reconcile queue
membership, abandonment, inventory, spend, and remaining budget. Canonical
metrics are derived from events, never frames.

Because CP1 froze the original contracts, this expansion requires one joint
CON-02 contract PR before implementation. CON-02 must keep the public
`runSimulation(festival, settings)` signature but may extend the serializable
Festival, settings, profile, frame, event, and result shapes needed for generic
destinations and event-derived destination metrics. Schema version 1 treats
these input additions as backwards-compatible: missing amenities mean an empty
list and missing behavior settings resolve to the documented defaults. Every
new `SimulationResult` snapshots the fully resolved settings.

## Deterministic seed strategy

- Convert `SimulationSettings.seed` to a `pure-rand` generator; never call `Math.random()` in engine code.
- Derive stable named streams for `arrivals`, `profiles`, `choice`, `service`, and `movement` from the run seed. Adding movement draws must not shift profiles or service times.
- Assign attendee intent and itinerary decisions from a named stream that is independent from movement draws. Baseline and alternative layouts reuse the same profiles and intent assignments.
- Sort attendees and vendors by stable ID before resolving simultaneous decisions.
- Initialize attendee profiles and spawn times once, then store them in `SimulationResult`.
- Baseline and alternative use the same seed and profiles. A comparison warns or rejects when duration, step, attendee count, or profiles differ.
- Do not include wall-clock runtime in deterministic snapshots.

## Performance budgets

- Default 250 attendees, maximum P0 control 300.
- Record at most one full frame per simulated second unless profiling proves a higher rate safe.
- Target simulation completion under 2 seconds on a current hackathon laptop and playback at 30+ FPS.
- Benchmark Konva before considering PixiJS. Move computation to a Web Worker only after measured UI blocking.

## Optional services

P1 LLM explanations receive a compact structured comparison and recommendations; they never calculate metrics or control agents. P2 Supabase stores versioned festival/result documents and requires RLS. Both require a separate architecture approval.

## Merged queue-retention extension

Merged in PR #11 on main `785ed94` (2026-11-14), exceeding queue patience or rejection
from a full waiting queue ends that stall visit and returns the attendee to
bounded destination selection, rather than directly exiting the festival.
Normal time, budget, eligibility and itinerary limits still apply.
Engine-produced `queueFrustration` lasts 15 simulated seconds; red is a modeled
frustration cue, not an observed emotional state. A `missed_sale` event records
one opportunity at the rejected stall's average price, per the user's selected
demo assumption. Analytics sums these into optional per-vendor `missedSales`.
These opportunities do not reduce purchase revenue, attendee budget or stock,
and are not losses of actual festival revenue. Stockout removals and ordinary
festival exits are not assigned invented missed purchases. Shared contract
changes require both developers' review under AGENTS.md before merge.

Playback business figures are analytics-owned reductions of canonical events
through each recorded frame timestamp, not calculations from frames. Optional
cumulativeRevenue/cumulativeMissedSales/cumulativeMissedSaleValue fields drive
selected-moment display; final result metrics remain available independently.
Shared business accumulation is reused for final and timestamped values. The
consolidated handoff and TASKS distinguish merged implementation from pending
manual/performance acceptance and downstream feature work. New shared changes
still require joint review; merge history alone is not attributed approval.

## Opt-in demonstration retention (human review before merge)

User-authorized extension: `BehaviorSettings.retainAttendeesUntilEnd?: boolean`
resolves to false by default. When true, normal itinerary, affordability,
individual visit-time and destination limits still bound actual visits. A
would-be departure instead becomes idle-on-site dwelling without an active
visit or destination; the engine supplies `stayingUntilEnd` on its frame.
Nobody exits before the global run end. End-of-run cleanup releases queues and
servers, truncates active visits and emits exactly one run_ended exit per guest.

In this illustrative mode, an actual recorded queue departure's frustration
marker persists until closing, rather than the normal 15-second interval.
It represents a modeled queue-frustration experience during the event, not a
measurement of continuous emotion. Markers clear in the closing frame. Prices,
purchases, missed-sale opportunity events and all metric reducers are unchanged.
The demo opts in; ordinary runs do not. Fair comparison requires matching
retention settings, and paired capacity scenarios reuse the same setting.
The shared-field change is authorized for implementation with joint developer
review required before merge, per the user’s explicit approval in this task.

## User-authorized organizer accounts extension

The original guest-only P0 remains usable. The user subsequently authorized
real email/password accounts and private cross-device layout templates.
Optional Supabase browser auth and RLS-protected JSONB persistence now live in
`features/account` and `features/templates`, with narrow editor integration.
No auth/database dependency enters domain contracts, engine or analytics.
Only public project configuration reaches the client; no service-role key is
used. Node.js 22+ is required by the official Supabase client. Setup, access
policies, schema versioning, draft handoff and remaining real-project checks
are documented in ORGANIZER-ACCOUNTS-SETUP.md. This supersedes the original
no-auth decision only for this explicit extension; cloud setup is still pending.
