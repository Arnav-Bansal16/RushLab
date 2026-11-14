# RushLab agent guidance

## Mission and scope

Build a credible weekend MVP that compares festival layouts using deterministic simulation and real calculated metrics. Prefer a working vertical slice over breadth. Do not describe modeled outputs as forecasts.

Until the humans approve architecture and begin development, edit only documentation, contracts, fixtures, configuration, and minimal scaffolding.

## Source of truth

- Read `docs/ARCHITECTURE.md` before changing boundaries or shared contracts.
- Read the relevant task in `docs/TASKS.md`; do not invent a parallel interface.
- `src/domain/**` and `src/fixtures/**` are jointly owned. Changes require review from both developers.
- Developer A owns `src/app`, `src/components`, and `src/features`.
- Developer B owns `src/simulation` and `src/analytics`.

## Non-negotiable boundaries

- Simulation and analytics must not import React, Konva, Recharts, browser timers, or database clients.
- UI renders `SimulationFrame` and `SimulationResult`; it does not calculate canonical metrics.
- Engine code must never call `Math.random()`. Use named seeded streams.
- Simulation time uses a fixed step and world coordinates are meters. Rendering converts meters to pixels.
- Events are canonical for business metrics; frames exist for playback.
- Baseline and alternative scenarios reuse the same attendee profiles and compatible settings.
- No per-attendee LLM calls, hidden network calls, or secrets in client code.

## Change discipline

- Make the smallest change that satisfies the assigned task; preserve public contracts unless the task explicitly changes them.
- Do not add production dependencies without explaining the need in the PR.
- Keep the app runnable. Integrate one vertical slice at a time.
- Use subagents only for independent read-heavy work or clearly separated files. Agents editing the same files must not run in parallel.

## Verification

Run targeted tests while working, then before merge:

```bash
npm run verify
```

Simulation changes also need tests for determinism, event/metric agreement, queue conservation, inventory, and scenario compatibility. UI changes need an integration check against the shared fixture.

## Done means

The requested behavior works, relevant tests pass, types remain compatible, docs change only when behavior/contracts changed, and the diff contains no unrelated rewrites.

## Code Review Rules

- Flag any `Math.random()` call under `src/simulation`.
- Flag metrics calculated independently in UI code.
- Flag scenario comparisons that change seed, attendee profiles, duration, or demand assumptions without a visible warning.
- Flag claims that recommendations or revenue are forecasts rather than modeled estimates.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
