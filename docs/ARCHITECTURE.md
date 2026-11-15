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
                                      └── comparison ────┘
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
