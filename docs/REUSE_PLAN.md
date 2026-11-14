# Reuse and license plan

## Runtime dependencies

| Package | License | Use | Rule |
|---|---|---|---|
| Next.js / React | MIT | Application framework | Preserve notices in third-party attribution. |
| Konva / react-konva | MIT | Map editor and playback | Use public APIs; do not copy internals. |
| Recharts | MIT | Metrics and comparisons | UI only; no canonical calculations. |
| pure-rand | MIT | Reproducible RNG state | Wrap behind `src/simulation/random.ts`. |
| Tailwind CSS | MIT | Styling | Build-time/runtime CSS tooling only. |

Before production release, generate a dependency license inventory and include all required notices. MIT permits commercial use, modification, and distribution when copyright and permission notices are retained.

## Reference-only projects

- `jphinspace/festival` (MIT): port only small queue/movement ideas or tests with source URL, commit, and attribution in the PR.
- `anesask/discrete-sim` (MIT): reference named PRNG streams, resource invariants, and reneging tests; no P0 runtime dependency.
- JuPedSim (LGPL-3.0), Menge (Apache-2.0), Yuka and PathFinding.js (MIT): algorithm research only for P0.

Do not paste code whose license or origin is unclear. Do not combine GPL/LGPL source into RushLab without explicit human approval and a license-obligation review.

## Feature-by-feature implementation matrix

| Feature | Provider / exact API or file | Action | Difficulty | Owner | Depends on |
|---|---|---|---:|---|---|
| 2D map | `react-konva`: `Stage`, `Layer`, shapes | Build domain layers | M | A | contracts |
| Stages, entrances, paths | Konva `Rect`, `Line`, `Circle` | Build | L | A | map transform |
| Draggable vendors | Konva `draggable`, `onDragEnd` | Build bounds/snap/state update | L | A | editor state |
| Custom vendors/capacity | React form + `Vendor` | Build | L | A | contracts |
| Attendee generation/preferences | pure-rand generators | Build named streams/profile factory | M | B | seed policy |
| Agent movement | festival `agent.js`/`pathfinding.js` ideas; no unchanged reuse | Build waypoint movement; selectively port tested geometry if useful | H | B | paths, profiles |
| Queueing/service | festival queue files and discrete-sim `Resource` as references | Build deterministic state machine | M | B | events/time |
| Purchasing/abandonment/inventory | None | Build domain events and rules | M | B | queues |
| Playback | Konva + `SimulationFrame[]` | Build frame cursor/interpolation | M | A | frame contract |
| Vendor performance/revenue | `SimulationEvent[]` | Build reducers; UI only renders | M | B | event ledger |
| Scenario comparison | `ScenarioComparison` | Build compatibility guard/deltas | L | B | results |
| Placement suggestions | `PlacementRecommendation` | Build bounded rules/candidates | M | B; A reviews | metrics + constraints |
| Historical CSV | Browser File API; parser selected in P1 | Build later with validation | M | A | stable schema |
| AI explanations | Optional P1 server route / AI SDK | Build later; structured input only | M | A | stable comparison |
| Authentication/saves | Optional P2 Supabase | Build later with RLS | H | joint | versioned projects |
| Deployment | Vercel Next.js adapter | Configure preview/public demo | L | A | P0 runnable |

“Build” means RushLab-specific code. “Reference” does not authorize copying; attribution and license review are required if code crosses into this repository.
