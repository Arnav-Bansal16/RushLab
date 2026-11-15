# SIM-03 to UI-04 integration handoff

## Integration baseline

SIM-03 is delivered in [PR #8](https://github.com/Arnav-Bansal16/RushLab/pull/8)
on `codex/sim-03-bounded-behavior`. The verified implementation head is
`4777c9c`. It includes the queue-capacity, bounded-dwell, and run-end playback
fixes found during review.

Before starting UI-04, fetch the latest `main` and create the UI branch from
the merge commit that contains PR #8. Do not copy simulation code into the UI
branch or start from an older SIM-02-only checkout. If PR #8 has not merged,
coordinate the integration base rather than independently changing shared
contracts.

At the SIM-03 head, verification is green:

- 120 committed tests pass;
- lint and strict TypeScript checks pass;
- the production Next.js build passes;
- multi-seed audits reconcile deterministic events, frames, queues, inventory,
  budgets, exits, and ANA-01 vendor metrics; and
- the worktree and remote branch are synchronized.

This document describes the implemented boundary. `docs/ARCHITECTURE.md` and
`docs/TASKS.md` remain the source of truth for behavior and task acceptance.

## Ownership and scope

UI-04 is owned by Developer A and should remain within:

- `src/features/editor/**`;
- a focused simulation-settings feature under `src/features/**`;
- `src/features/playback/**`; and
- the smallest required composition change under `src/app/**`.

SIM-03 owns attendee choice, intent, roaming, dwell, queue tolerance, price
elasticity, budgets, itinerary limits, exits, and frame/event production under
`src/simulation/**`. UI-04 must not change those rules or calculate canonical
metrics.

Changes to `src/domain/**` or `src/fixtures/**` are not expected. If UI-04
cannot be implemented with the existing contracts, stop and request a small
joint contract review rather than adding a UI-private interpretation.

## Exact engine handoff

Keep the existing public boundary:

```ts
import { prepareSimulationInput } from "@/features/editor/simulationInput";
import { runSimulation } from "@/simulation";

const input = prepareSimulationInput(layout, requestedSettings);
if (!input.ok) {
  // Display errors and warnings; do not call the engine.
} else {
  const festivalSnapshot = structuredClone(input.festival);
  const settingsSnapshot = structuredClone(input.settings);
  const result = runSimulation(input.festival, input.settings);

  setActiveRun({
    festivalSnapshot,
    settingsSnapshot,
    result: structuredClone(result),
    warnings: [...input.warnings],
  });
}
```

`SimulationSettings.behavior` is an optional partial input. Every returned
`SimulationResult.settings.behavior` is fully resolved. UI-04 should use
`DEFAULT_BEHAVIOR_SETTINGS` to initialize controls and use `result.settings`
when displaying the assumptions that actually governed a completed run.
`ActiveRun.settingsSnapshot` is the requested input and may remain partial; do
not present it as the resolved engine configuration.

Festival, settings, result, events, and frames are immutable snapshots for the
active run. Later editor or form changes must not alter playback or results.

## Implemented SIM-03 behavior

The engine now provides:

- stable `stage_first`, `vendor_first`, `explorer`, and `amenity_first`
  intents;
- deterministic bounded itineraries across stages, vendors, restrooms,
  seating, and first aid;
- overall, per-type, and per-destination visit limits;
- optional bounded revisits with immediate duplicate destinations forbidden;
- seeded in-bounds explorer waypoints;
- deterministic stage and amenity dwell using global defaults or location
  overrides;
- affordable price-sensitive vendor choice and exact remaining-budget updates;
- vendor-only FIFO queues, service, purchases, inventory, and stockouts;
- queue tolerance using the attendee value multiplied by the global setting;
- typed exit reasons and non-teleporting final playback positions; and
- canonical destination visit events plus generic frame targets.

These are modeled assumptions, not observed human behavior or forecasts.

## UI-04 required editor work

### Canonical amenities

`Festival.amenities` is optional for backwards compatibility; missing means an
empty list. UI-04 must make supported amenities canonical instead of leaving
them in `editor.elements`:

- initialize new layouts with `amenities: []`;
- map seating, restroom, and first-aid components to `Amenity` objects;
- include amenities in `layoutItems`, editing, moving, resizing, deletion,
  undo, clear, import, and JSON export behavior;
- preserve `type`, `position`, `size`, `attraction`, and an optional
  `dwellDurationOverrideSeconds`; and
- keep exits, parking, and custom objects as visual/editor-only elements.

The current `snapshotFestival` omits `amenities`. UI-04 must include a cloned
amenity array so the engine can select those destinations. Festival validation
must include amenity IDs in the common uniqueness scope and validate:

- finite in-bounds geometry;
- a finite non-negative attraction;
- type in `restroom | seating | first_aid`; and
- optional dwell minimum/maximum in `0..3600`, with minimum no greater than
  maximum.

Stage validation must apply the same optional dwell-override rules.

### Vendor and destination properties

Expose the existing contract fields without inventing UI-only equivalents:

- vendor `averagePrice`: finite value from 0 through 10,000;
- vendor `serviceTimeSeconds`: finite value greater than 0 and at most 3,600;
- stage `attraction` and optional dwell override;
- amenity `attraction`, type, and optional dwell override; and
- inheritance when a stage or amenity override is absent.

Creation defaults may use the existing contract/demo values, but the form must
make the active values visible and editable.

## UI-04 required settings work

Use the names and limits already defined by `BehaviorSettings`:

| Setting | UI validation |
| --- | --- |
| `maximumItineraryStops` | integer 1 through 6 |
| vendor/stage/amenity maximum stops | integer 0 through the overall maximum |
| `maximumVisitsPerDestination` | integer 1 through the overall maximum |
| `roamingWaypoints` | integer 0 through 2 |
| `queueToleranceMultiplier` | finite 0 through 5 |
| `priceElasticity` | finite 0 through 10 |
| `deterministicExitProbabilityAfterStop` | finite 0 through 1 |
| `minimumRemainingTimeSeconds` | finite 0 through 3,600 |
| intent, destination, and vendor-category weights | finite 0 through 10 |
| each dwell minimum and maximum | finite 0 through 3,600; minimum <= maximum |

The advanced panel must cover intent and destination weights, overall/per-type
and revisit limits, roaming, dwell ranges, queue tolerance, price elasticity,
and the seeded post-stop exit setting required by `docs/TASKS.md`.

All-zero eligible destination weights are safe: the engine emits a typed
`no_eligible_destination` exit. The UI should show a clear warning that guests
will exit without a visit; it must not silently replace zeroes or create a
private fallback choice.

Catch domain validation errors before starting a run and present useful field
messages. Rejected attempts must not replace the previous successful active
run.

## Playback contract

Each `SimulationFrame` is a complete immutable snapshot. Continue converting
world-space meters to pixels only in rendering.

Render the engine-provided attendee status directly:

| Status | UI meaning |
| --- | --- |
| `entering` | spawned at an entrance |
| `choosing` | selecting the next eligible destination |
| `walking` | moving toward a destination |
| `roaming` | following seeded explorer waypoints |
| `queued` | waiting in a vendor queue |
| `purchasing` | occupying vendor service capacity |
| `dwelling` | visiting a stage or amenity |
| `leaving` | moving toward the entrance |
| `exited` | finished; retain identity for scrubbing |

Use `attendee.target` for generic destination presentation. It contains a
`destinationId` and `destinationType`. `targetVendorId` remains for backwards
compatibility and vendor-specific playback, but UI-04 must not treat it as the
only possible target. Targets may be `null` while choosing, leaving, or exited.

The current presentation helper already resolves generic target names and the
status style table covers all SIM-03 statuses. UI-04 still needs to:

- draw amenities on `PlaybackCanvas`;
- ensure stages and amenities remain visually distinguishable;
- show dwelling and generic target details accessibly;
- preserve run-ended attendees at their supplied final positions; and
- update the SIM-02-era copy that says price, multi-stop, roaming, and dwell do
  not yet influence behavior.

Do not infer visits, wait, revenue, demand, or dwell metrics from frames.
Events are canonical for business calculations. ANA-03 will populate
`destinationMetrics` and `destinationTransitions`; SIM-03 intentionally leaves
those arrays empty until that task lands.

## Required UI-04 tests

Add focused tests for:

- canonical amenity create/edit/move/resize/delete and JSON snapshot handoff;
- amenity and stage dwell-override inheritance and validation;
- vendor price and service-time creation/editing;
- every behavior field's numeric and relational limits;
- all-zero eligible-weight warning and safe engine handoff;
- immutable festival/settings/result snapshots after later form or layout edits;
- rejected-run behavior preserving the prior successful run;
- resolved assumptions displayed from `result.settings`;
- generic stage/vendor/amenity target descriptions;
- all nine attendee statuses, including dwelling and roaming;
- amenity drawing and empty/missing `amenities` compatibility;
- empty, single, first, sparse, and final playback-frame boundaries; and
- a real engine run containing a stage, two vendors, and all three amenity
  types.

Run narrow frontend/engine integration tests while working, then run:

```bash
npm run verify
```

Also complete the documented 300-attendee browser playback check. Record the
browser/device result rather than adding a brittle wall-clock unit test.

## Integration acceptance flow

UI-04 is ready when a reviewer can:

1. build or load a festival with a stage, two vendors, seating, a restroom,
   and first aid;
2. edit vendor price/service time and stage/amenity dwell assumptions;
3. change a small set of advanced behavior controls with accessible labels;
4. run 200–300 attendees from an immutable festival/settings snapshot;
5. observe stage, vendor, roam, amenity, queue, service, dwell, and exit states;
6. inspect the fully resolved modeled assumptions used by the run;
7. rerun the same input and seed with identical profiles, events, frames, and
   metrics; and
8. see visible language that outputs are modeled estimates, not forecasts.

At integration time, rerun the SIM-03 determinism, queue conservation,
inventory, event/metric agreement, and UI fixture tests. UI-04 must not require
a simulation contract change for this flow.

## Known downstream boundary

ANA-03, not UI-04, derives destination visit, dwell, and transition summaries
from `destination_visit_start` and `destination_visit_end` events. INT-01 later
compares scenarios using the same seed, attendee profiles, duration, demand,
and behavior assumptions or surfaces a warning. UI-04 should preserve these
snapshots now so those later tasks do not need to reconstruct inputs.
