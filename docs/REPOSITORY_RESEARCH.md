# Open-source repository research

Research date: 2026-11-13. “Verified” means inspected repository source, license, history, or local execution; “inferred” is labeled. Dates are repository activity, not guarantees of support.

## Decisive finding

Start from this repository's minimal Next.js scaffold, not a third-party application. Use [jphinspace/festival](https://github.com/jphinspace/festival) as a behavioral/test reference and reuse focused MIT packages. Approach C is lower-risk than forking or extracting coupled modules.

## Comparison

| Project | License / commercial duty | Language / framework | Maintenance and docs | Relevant verified features | Gaps and integration | Local status |
|---|---|---|---|---|---|---|
| [jphinspace/festival](https://github.com/jphinspace/festival) | MIT; retain notice | JavaScript ES modules, Canvas, Jest | Last meaningful commit 2025-10-13; extensive but partly stale docs | Attendees, movement, obstacle routing, two-sided food queues, fixed stalls, basic queue metrics | Canvas/render loop is coupled to mutable simulation; hard-coded geometry; no seed, sales, inventory, abandonment, results API, editor, or scenario comparison. Custom coordinates exist only at constructor level. Browser-native; Vercel needs packaging changes. | **Verified:** `npm ci`; 620/620 tests passed; static HTTP/module launch returned 200. 16 dev-tree audit findings. |
| [anesask/discrete-sim](https://github.com/anesask/discrete-sim) | MIT; retain notice | TypeScript DES library | Active 2026; strong API guide/tests | `Simulation`, `Process`, `Resource`, queues, reneging patterns, statistics, seeded named `Random.stream()`, async/browser drivers | No spatial movement/editor/business model. Combining continuous playback with its event clock adds complexity. Browser smoke test exists; Vercel-compatible as a library. | **Verified:** v0.1.20 built; typecheck passed; 797/797 tests passed. |
| [konvajs/konva](https://github.com/konvajs/konva) + [react-konva](https://github.com/konvajs/react-konva) | MIT; retain notices | TypeScript/JS Canvas + React bindings | Very active; Konva 10.9.1 on 2026-10-31; good docs | `Stage`, `Layer`, shapes, transforms, events, drag/drop, export | Provides rendering/editor primitives only. 200–300 animated shapes is plausible but must be benchmarked. Excellent browser/Vercel fit. | Not cloned; official source/docs inspected. |
| [pixijs/pixijs](https://github.com/pixijs/pixijs) | MIT; retain notice | TypeScript WebGL/WebGPU/Canvas | Very active; v8.23.0 on 2026-11-11; strong docs | High-throughput scene graph, ticker, graphics, pointer events | More editor plumbing than Konva; no simulation/business logic. Use only if Konva benchmark fails. | Not locally tested. |
| [Mugen87/yuka](https://github.com/Mugen87/yuka) | MIT; retain notice | JavaScript game-AI library | Last master activity found 2023-01-16; good but aging docs | Steering, graph search, `NavMesh.findPath`, engine-independent updates | 3D-vector model for a 2D problem; no queues/economics; package lacks first-class TS declarations. Browser-compatible. | Not locally tested. |
| [PedestrianDynamics/jupedsim](https://github.com/PedestrianDynamics/jupedsim) | LGPL-3.0; linking/modification obligations require review | C++20/Rust core, Python API | Active through 2026-10; excellent docs | Walkable geometry, agents, journey/waypoint/queue stages, per-iteration state, trajectory writers | Strong science but requires native/Python service or major WASM work; no vendor commerce. Poor weekend/Vercel fit. Seeded placement exists; whole-run determinism not verified. | Not locally tested. |
| [MengeCrowdSim/Menge](https://github.com/MengeCrowdSim/Menge) | Apache-2.0; retain license/NOTICE and modification notices; patent terms | C++ with SDL visualization | Last master commit 2019-12-31; old build docs | Modular crowd models, scenario examples, native crowd simulation | Stale native toolchain, no browser editor or vendor economics. Major port needed. | Not locally tested. |
| [qiao/PathFinding.js](https://github.com/qiao/PathFinding.js) | MIT; retain notice | JavaScript grid pathfinding | Last activity found 2023-07-17; old npm release | `PF.Grid`, A*, Dijkstra, BFS, browser build; deterministic for fixed grid | Grid only, old tooling, no TypeScript/local avoidance/queues. A small cached waypoint graph may be simpler. | Not locally tested. |
| [dubzzz/pure-rand](https://github.com/dubzzz/pure-rand) | MIT; retain notice | TypeScript PRNG library | Active; v8.4.2 on 2026-07-10; good docs | Repeatable immutable RNGs, distributions, `jump()` for separated streams | No simulation semantics. Excellent browser/Vercel fit and negligible scale concern. | Source/docs inspected; selected dependency. |
| [recharts/recharts](https://github.com/recharts/recharts) | MIT; retain notice | TypeScript React/SVG charts | Active; stable 3.10.1 in 2026; good docs | Bar/line charts, axes, tooltips, responsive containers | Presentation only; metrics stay in analytics. Excellent Vercel fit. | Source/docs inspected; selected dependency. |

## Required capability checks

| Project | Custom vendor positions | 200–500 agents | Exposes useful data | Reproducible | Browser / Vercel |
|---|---|---|---|---|---|
| festival | Constructor accepts coordinates; fixed manager overrides layout | Core-only benchmark: 200 = 0.97 ms, 300 = 1.66 ms, 500 = 4.82 ms/update; browser FPS unverified; O(n²) neighbor scans | Mutable agents/queues and basic metrics; no event/result schema | **No:** widespread `Math.random`, frame delta, timers | Browser yes; Next/Vercel integration work required |
| discrete-sim | Domain must build it | 300-customer browser smoke model exists; spatial workload not applicable | Traces, resource stats, simulation result | **Yes:** seed plus named streams | Yes |
| Konva / PixiJS | Yes, as rendered/editor objects | Rendering target must be benchmarked | UI state only | N/A | Yes |
| Yuka | Domain must build it | Exact RushLab scale unverified | Entity/navigation state | Fixed-step updates can be stable; PRNG remains ours | Yes |
| JuPedSim | Geometry/stage translation required | Designed for crowds; exact target benchmark not verified | Detailed agent/trajectory APIs | Placement seed verified; whole run unverified | No direct browser/Vercel runtime |
| Menge | XML scenario changes | Crowd scale plausible; exact result unverified | Native simulation outputs | Random implementation exists; replay API unverified | No |
| PathFinding.js | Grid endpoints are configurable | Cache routes; 500 independent searches unverified | Paths | Yes for fixed input | Yes |
| pure-rand / Recharts | N/A | N/A | PRNG state / chart props | pure-rand yes | Yes |

## Detailed initial-repository inspection

Useful source in `festival`:

- [`src/core/simulation.js`](https://github.com/jphinspace/festival/blob/b49596e/src/core/simulation.js): coupled update/render loop.
- [`src/core/agent.js`](https://github.com/jphinspace/festival/blob/b49596e/src/core/agent.js) and [`src/core/pathfinding.js`](https://github.com/jphinspace/festival/blob/b49596e/src/core/pathfinding.js): movement and avoidance reference.
- [`src/core/queueManager.js`](https://github.com/jphinspace/festival/blob/b49596e/src/core/queueManager.js), [`src/core/queuedProcessor.js`](https://github.com/jphinspace/festival/blob/b49596e/src/core/queuedProcessor.js), and [`src/components/foodStall.js`](https://github.com/jphinspace/festival/blob/b49596e/src/components/foodStall.js): queue patterns worth porting with tests.
- [`src/managers/eventManager.js`](https://github.com/jphinspace/festival/blob/b49596e/src/managers/eventManager.js): demonstrates why a fork is risky—stalls and event geometry are generated imperatively.
- [`src/utils/metricsCollector.js`](https://github.com/jphinspace/festival/blob/b49596e/src/utils/metricsCollector.js): useful concepts but insufficient business outputs.

Estimated reusable value is 10–20% by adapted idea/test, not a majority of the application. Any copied code must retain MIT attribution and be recorded in `docs/REUSE_PLAN.md`.

## Approach comparison

| Approach | Time | Integration risk | Maintainability | Business fit | Weekend verdict |
|---|---:|---:|---:|---:|---|
| A. Fork `festival` | Demo starts quickly; replacement work dominates | High | Low–medium | Low until major rewrite | Reject |
| B. Extract modules | Medium | High due mutable/canvas assumptions | Medium | Medium | Use only for tiny isolated algorithms/tests |
| C. Small typed engine + focused libraries | Medium-fast | Low–medium | High | High | **Choose** |

## Uncertainties and fallback

- Konva performance is an assumption until task UI-03 benchmarks 300 circles; fallback is PixiJS for the attendee layer only.
- Movement realism is not validated pedestrian science; fallback is a simple predefined path graph and explicit limitation language.
- If custom engine queue logic slips, use `discrete-sim`'s `Resource` patterns as a reference; do not adopt it midstream without a short integration spike.
