# SIM-02 and UI-02 integration handoff

## Implemented SIM-02 handoff

SIM-02 is implemented on `codex/sim-02-queue-service` at commit `711e2c2`.
The simulation side is merge-ready for the scope in `docs/TASKS.md`; no shared
domain contract, fixture, UI, analytics, or package dependency changed.

The concrete engine boundary remains:

```ts
import { runSimulation } from "@/simulation";

const result = runSimulation(festivalSnapshot, settingsSnapshot);
```

Implementation ownership is contained in:

- `src/simulation/queue/vendorQueue.ts` for FIFO waiting state, admission,
  server slots, timeout boundaries, inventory, and slot release;
- `src/simulation/events/order.ts` for stable same-timestamp event ordering;
- `src/simulation/events/reduce.ts` for temporary contract-valid aggregates
  derived from the event ledger until ANA-01 owns the final reducer;
- `src/simulation/runSimulation.ts` for fixed-step composition with the SIM-01
  profiles, arrivals, vendor choice, movement, named streams, and frames;
- adjacent unit and integration tests under `src/simulation/**`.

### Implemented fixed-step behavior

For each fixed step, the engine deterministically:

1. spawns due attendee profiles in spawn-time and attendee-ID order;
2. completes due service slots, emits purchases, updates inventory and sales,
   and emits a one-time stockout when finite inventory reaches zero;
3. removes waiting attendees whose queue tolerance has reached its exact
   boundary and emits `queue_abandon`;
4. advances walking/leaving attendees through the existing SIM-01 waypoint
   movement;
5. admits vendor arrivals in vendor-ID then attendee-ID order, respecting
   waiting queue limits and deterministic full-queue rejection;
6. fills available server slots FIFO and draws each duration only from the
   named `service` stream;
7. applies run-end cleanup through the existing exit path for unresolved
   admitted requests; and
8. records a complete frame after all events for that frame timestamp have
   been applied.

A request rejected because the waiting queue is full begins leaving without a
new event. The frozen v1 event union has no queue-rejection event. A request
removed from a waiting queue by stockout emits `queue_abandon`, keeping the
event ledger and frame queue length reconcilable.

### Verification completed

The implementation passed:

- FIFO, simultaneous ID tie-breaking, queue-limit, duplicate-membership, and
  service-slot-release unit tests;
- capacity-one versus capacity-two throughput tests under common demand;
- exact-boundary timeout abandonment;
- finite and unlimited inventory, non-negative inventory, one-time stockout,
  and no-purchase-after-stockout checks;
- event/frame reconciliation for queue length, inventory, and cumulative sales;
- same-seed equality, different-seed inequality, named-stream independence,
  monotonic time, in-bounds positions, input immutability, JSON serialization,
  and multiple explicit seeds;
- the one-attendee spawn → walk → queue → service → purchase → exit slice; and
- `npm run verify`: lint, typecheck, all 52 repository tests, and the production
  Next.js build.

A real UI-01 `prepareSimulationInput` snapshot of `demoFestival` was also run
through the actual engine with 250 attendees. It produced 181 ordered playback
frames, 402 canonical events, all six attendee statuses, stable attendee/vendor
ID ordering, and an approximately 2.54 MB JSON result without mutating the
layout, festival snapshot, or settings.

### UI-02 implementation checklist

UI-02 can build against the frozen `SimulationResult` contract without an
engine change. It should:

- retain the UI-01 festival and settings snapshots alongside the result;
- treat `frames` as immutable, complete snapshots ordered by `timeSeconds`;
- render positions in meters through the existing renderer transform;
- render the supplied attendee status and `targetVendorId` without inferring
  queue or purchase state independently;
- show vendor `queueLength`, `inventoryRemaining`, and `cumulativeSales`
  directly from each selected frame;
- preserve `null` inventory as unlimited rather than displaying it as zero;
- keep exited attendees addressable while scrubbing, even if presentation
  chooses to fade or hide them;
- clamp cursor access at the first and final available frames and handle empty
  or one-frame inputs;
- keep pause, restart, speed, scrub, and interpolation state outside the
  `SimulationResult`; and
- avoid calculating revenue, wait, utilization, throughput, or other canonical
  business metrics from frames. ANA-01 owns those reductions from events.

The remaining UI-02-specific gates are browser playback behavior and a manual
300-circle performance check at 30+ FPS. Those cannot be completed until the
playback implementation exists and are not SIM-02 merge blockers.

## Purpose and source of truth

SIM-02 adds queues, service, purchases, abandonment, inventory, and stockout
behavior to the deterministic engine. UI-02 adds playback controls and renders
the engine's sparse frames. They integrate through the existing v1 contracts
in `src/domain/simulation.ts`; this handoff explains those contracts but does
not replace or extend them.

If either task needs a new field or event, stop and open a small contract PR
first. Update the shared fixture and contract tests, obtain joint review, merge
that PR, and rebase both task branches before continuing.

## Branch and folder ownership

- SIM-02 owns `src/simulation/queue/**`, `src/simulation/events/**`, necessary
  composition inside `src/simulation/**`, and adjacent simulation tests.
- UI-02 owns `src/features/playback/**` and the narrow editor/app composition
  needed to run and display a result.
- Neither task changes `src/domain/**` or `src/fixtures/**` independently.
- UI code must not implement queue, service, purchase, stockout, inventory, or
  canonical metric calculations.
- Simulation code must not import React, Konva, browser timers, or database
  clients, and it must never call `Math.random()`.

Agents working concurrently must not edit the same composition file. Agree on
one integrator for the final editor/playback wiring.

## Exact run handoff

UI-02 must continue using the validated, cloned editor input from UI-01:

```ts
import { prepareSimulationInput } from "@/features/editor/simulationInput";
import { runSimulation } from "@/simulation";

const input = prepareSimulationInput(layout, settings);
if (!input.ok) {
  // Show input.errors and input.warnings. Do not call the engine.
} else {
  // Keep warnings visible and retain these snapshots for this result.
  const festivalSnapshot = input.festival;
  const settingsSnapshot = input.settings;
  const result = runSimulation(festivalSnapshot, settingsSnapshot);

  // Playback receives engine output. It must not mutate result or derive
  // canonical business metrics from frames.
  setActiveRun({ festivalSnapshot, settingsSnapshot, result });
}
```

Later editor changes must not alter the active festival, settings, result,
events, or frames. Running again creates a new snapshot and result.

## Playback input contract

UI-02 consumes `SimulationResult.frames` in ascending `timeSeconds` order.
Each `SimulationFrame` is a complete playback snapshot for that recorded time,
not a delta from the previous frame.

At a frame timestamp:

- all simulation events at or before that timestamp have been applied;
- attendee and vendor arrays use stable ID order;
- positions are world-space meters and the renderer alone converts them to
  pixels;
- attendees that have not spawned are absent;
- spawned attendees, including attendees with `status: "exited"`, remain in
  subsequent frames so identity and scrubbing remain stable;
- vendor entries exist in stable vendor-ID order, including vendors with no
  demand.

Frames are intentionally sparse, normally one per simulated second. UI-02 may
interpolate positions for visual smoothness, but interpolation is presentation
only: it must not invent events, status transitions, queue values, inventory,
sales, or metrics. Status and vendor state change only at a recorded frame.

UI-02 must handle:

- an empty frame array without crashing;
- a frame with no attendees or no vendors;
- a one-frame result;
- the first and last available frame without indexing past the array;
- pause, resume, scrub, restart, and speed changes without altering engine
  state;
- a final recorded time that is the last fixed-step/frame boundary and is not
  assumed to equal `durationSeconds` for every valid setting combination.

## Attendee status semantics

Render the existing `AttendeeStatus` values; do not infer a different state
from events in the UI.

| Status       | Engine meaning                                                                    | Playback expectation                                                   |
| ------------ | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `entering`   | Spawned at an entrance on the current spawn tick.                                 | Show at the entrance; movement starts on a later fixed step.           |
| `walking`    | Moving through engine-selected waypoints toward a target.                         | Render at the frame position with `targetVendorId` when present.       |
| `queued`     | Waiting in a vendor's FIFO queue after `queue_join`.                              | Render at the engine position; do not calculate a separate queue.      |
| `purchasing` | Assigned to a server after `service_start`.                                       | Render as in service; this attendee is not part of `queueLength`.      |
| `leaving`    | Finished or abandoned the current visit and is following the engine's exit route. | Render the supplied position and target exactly.                       |
| `exited`     | Reached the engine exit point and emitted `exit`.                                 | Keep scrub identity stable; UI may visually hide/fade it consistently. |

`targetVendorId` is either a valid vendor ID or `null`. UI-02 must tolerate
`null` for layouts with no vendor and for attendees that are leaving or exited.
It must not select a replacement vendor.

## Vendor frame semantics

`VendorFrameState` is canonical playback state supplied by the engine:

- `queueLength` is the number waiting in the FIFO queue. It excludes attendees
  currently occupying server slots.
- `inventoryRemaining` is `null` for unlimited inventory; otherwise it is a
  non-negative item count after all events applied at the frame timestamp.
- `cumulativeSales` is the number of completed `purchase` events for that
  vendor through the frame timestamp. It is not revenue.

On purchase completion, the engine emits one `purchase`, decrements finite
inventory once, and increments `cumulativeSales` once in the same fixed step.
When finite inventory first reaches zero, the engine emits one `stockout` and
later purchases are forbidden. UI-02 displays these values but does not
reconstruct them from events.

## SIM-02 event and conservation rules

Events are the canonical business ledger. Frames exist for playback and must
agree with that ledger.

- Queue admission emits `queue_join` exactly once and respects `queueLimit`.
- Queues are FIFO; stable attendee ID resolves simultaneous decisions.
- `servers` limits concurrent `purchasing` attendees.
- Service assignment emits `service_start` exactly once per admitted service.
- A service request terminates in one purchase or one abandonment/exit path;
  no attendee may be served or charged twice for the same request.
- Timeout abandonment emits `queue_abandon` with the deterministic waited
  duration and removes that attendee from the queue exactly once.
- Purchase emits `purchase` with the vendor's modeled amount and updates
  inventory exactly once.
- Stockout prevents later purchase completion.
- Queue length, occupied servers, inventory, purchases, and exits never become
  negative or internally inconsistent.
- Events at the same timestamp are resolved deterministically using stable IDs
  and an engine-owned ordering. UI-02 must preserve event array order if it
  displays an event list.

SIM-02 must preserve SIM-01's named random streams. Service draws use the
`service` stream; adding queue, service, or movement draws must not change
attendee profiles or arrival times for the same inputs and seed.

## Metrics boundary

SIM-02 supplies a coherent ledger and frame state. ANA-01 owns final canonical
metric reduction from events. Until ANA-01 lands, UI-02 must not calculate or
present frame-derived revenue, wait-time, utilization, throughput, or queue
metrics as canonical results.

Any temporary values still returned in `SimulationResult.vendorMetrics` or
`totals` must remain contract-valid and clearly modeled, never described as a
forecast. Dashboard work waits for the event-derived ANA-01 implementation.

## Parallel development sequence

1. UI-02 builds cursor, play/pause, scrub, restart, and speed behavior against
   `demoSimulationResult.frames` without importing engine internals.
2. SIM-02 has implemented and tested queue/event behavior behind the existing
   `runSimulation(festival, settings)` export.
3. UI-02 adds visual handling for `queued`, `purchasing`, vendor queue length,
   inventory, cumulative sales, and stockout presentation using only frames or
   explicit events.
4. The integrator runs one real editor snapshot through the actual engine and
   gives the resulting frames to playback.
5. ANA-01 later replaces placeholder aggregates with event-derived metrics;
   UI-02 playback should require no semantic changes.

## Required integration checks

Before either PR merges, run targeted tests. Before the combined integration
merges, run `npm run verify` and confirm:

- same festival/settings/seed produce identical profiles, events, frames, and
  returned aggregates;
- a different seed changes deterministic modeled behavior;
- consuming additional movement draws does not shift profiles, arrivals, or
  service draws;
- one attendee completes spawn → walk → queue → service → purchase → exit;
- FIFO order and deterministic simultaneous-event ordering hold;
- capacity one versus two changes or preserves throughput under common demand;
- queue/server counts never become negative and no attendee is served twice;
- finite inventory never becomes negative, stockout emits once, and purchase
  cannot complete after stockout;
- purchase and abandonment counts reconcile exactly with ledger events;
- every frame time is monotonic and every attendee position is in bounds;
- frame queue length, inventory, and cumulative sales agree with events through
  that timestamp;
- playback handles empty, first, final, paused, scrubbed, and restarted states;
- playback never mutates its `SimulationResult` or the editor snapshot;
- a 250-attendee real result renders correctly, and a 300-circle manual check
  records at least 30 FPS on the demo laptop;
- the full result remains JSON-serializable and contains no wall-clock runtime.

## Definition of done

The SIM-02 side of this handoff is complete: a real UI-01 snapshot runs through
the real engine, event and frame state reconcile, deterministic/conservation
tests pass, and `npm run verify` is green. The combined handoff is complete once
UI-02 can play and scrub those returned frames without mutation and its manual
performance measurement is recorded in the integration PR.
