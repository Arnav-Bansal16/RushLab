# SIM-01 integration handoff

## Branch boundaries

The venue-builder changes are frontend-only and based on the approved CON-01
contracts on main. The existing SIM-01 implementation is on
`codex/sim-01-deterministic-engine` (tested head: `3ac20a8`).
Do not copy or rewrite backend files as part of merging the editor.
The engine export is `runSimulation` from `src/simulation/index.ts`.

The editor supports a blank canvas, multiple gates, vendors and stages, optional
walkways/obstacles, visual exits and custom areas, deletion/undo, and PNG export.
Sample playback was intentionally removed. Do not restore it during integration.

## Exact handoff

```ts
import { runSimulation } from "@/simulation";
import { prepareSimulationInput } from "@/features/editor/simulationInput";

const input = prepareSimulationInput(layout, settings);
if (!input.ok) {
  // Display input.errors and input.warnings; do not call the engine.
} else {
  // Keep input.warnings visible. Preserve these snapshots for result playback.
  const result = runSimulation(input.festival, input.settings);
  // A future playback view consumes result.frames. Canonical metrics come
  // from the engine/analytics, never from frontend calculations.
}
```

`layout` is the editor's LayoutDocument, held in FestivalEditor. Pass the saved
settings object from the run controls; this frontend has not added run controls
or a live engine import. A suitable P0 starting configuration is:

```ts
const settings = {
  seed: 42, attendeeCount: 250, durationSeconds: 120,
  stepSeconds: 0.5, frameIntervalSeconds: 1,
  walkingSpeedMetersPerSecond: 1.4,
};
```

The helper clones the approved Festival fields and settings, validates them,
and excludes the editor extension. Later layout edits cannot mutate a run.
A blank drafting canvas is allowed, but a run requires a valid entrance.
Zero vendors/stages and missing optional paths must not cause a frontend crash.
The upstream SIM-01 skeleton supports destination fallback and optional paths.

## Important limits

- Gates map to Festival.entrances with independent IDs and spawn weights.
- Exits/custom areas remain visual annotations and are explicitly excluded
  from engine inputs. Exit-aware routing needs a separate contract PR.
- Vendors/stages/paths/obstacles remain world-meter domain objects.
- Current SIM-01 provides seeded profiles, fixed-step movement, events, and
  sparse frames. It does not yet implement queues, purchases, abandonment, or
  real revenue/utilization calculations; those belong to SIM-02/ANA-01.
- The frontend validator is intentionally stricter for interactive P0 runs:
  safe-integer seed, 0–300 attendees, positive duration/rates, step no greater
  than duration, and frame interval no shorter than the step.
- No connected-path or collision-science guarantees are implied.
- A PNG is a visual plan, not an editable simulation document.
- Export simulation JSON supplies a plain Festival; settings are separate.

## Verification before merging engine integration

Run npm run verify on the combined branches, then the engine's same-seed,
different-seed, stream-independence, bounds/time, and 250-attendee checks.
Confirm multiple gates and a minimal gate-only layout. Preserve all source
snapshots and confirm results stay JSON-serializable. Future commerce metrics
must reconcile with events; future comparisons must keep common settings and
attendee profiles or show visible compatibility warnings.

## Verified cross-branch check

Before this frontend merge, the SIM-01 files from commit `3ac20a8` were overlaid
in an isolated worktree. Full npm run verify passed 34 tests, lint, typecheck,
and production build. Two additional temporary checks called the actual engine:
250 attendees with multiple gates produced identical full results on repeated
same-seed runs without mutating the editor draft; a gate-only layout also ran
without vendors, stages, or paths. Those temporary backend files and test were
removed before preparing the frontend PR. No engine files are included here.
