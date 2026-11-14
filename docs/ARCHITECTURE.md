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
vendor. The completed P0 must instead support a small, bounded intent model:

- `stage_first`: stage, then an optional affordable vendor;
- `vendor_first`: affordable vendor, then an optional stage or amenity;
- `explorer`: one or two seeded in-bounds waypoints, then a destination;
- `amenity_first`: restroom, seating, or first aid, then an optional vendor.

An attendee may visit at most three destinations. Stage and amenity visits use
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
  * vendor.averagePrice / max(attendee.budget, 0.01)
)

vendorUtility = settings.vendorWeight
  * attendee.categoryWeight
  * vendor.popularity
  * priceFactor
```

A vendor priced above the attendee's remaining budget is ineligible. Purchase
amount remains `vendor.averagePrice`. This is a transparent deterministic
behavior rule, not an elasticity forecast.

Behavior assumptions belong in serializable simulation settings and are
snapshotted with every run. The editor may expose advanced controls for intent
weights, destination weights, maximum stops, dwell ranges, roaming waypoints,
queue-tolerance multiplier, and global price elasticity. UI code must not
calculate choices or metrics.

Because CP1 froze the original contracts, this expansion requires one joint
CON-02 contract PR before implementation. CON-02 must keep the public
`runSimulation(festival, settings)` signature but may extend the serializable
Festival, settings, profile, frame, event, and result shapes needed for generic
destinations and event-derived destination metrics.

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
