# UI-02 → ANA-01 and UI-03 handoff

## Integration baseline

UI-02 is delivered in [PR #3](https://github.com/Arnav-Bansal16/RushLab/pull/3).
Its implementation head before this handoff is `88b8d23`; it includes planning
main `390d85c` and the real SIM-02 engine. After PR #3 merges, fetch main and
create each follow-up branch from that merged main. Do not start from an older
SIM-01 fixture-only branch. Check GitHub for the authoritative merge SHA.

Read AGENTS.md, ARCHITECTURE.md, TASKS.md, TESTING.md, INTEGRATION.md,
SIM-02-ANA-01-HANDOFF.md, and SIM-02-UI-02-HANDOFF.md first. Read the installed
Next.js guides before application/component changes. This handoff preserves
current contracts and does not override the task dependency graph.

## Delivered behavior and data flow

The editor passes its LayoutDocument to PlaybackWorkspace. The workspace calls
executeRun in `src/features/playback/run.ts`, using exactly:

```ts
const input = prepareSimulationInput(layout, settings);
if (input.ok) {
  const result = runSimulation(input.festival, input.settings);
}
```

Invalid input prevents engine execution. ActiveRun retains independent
festivalSnapshot, settingsSnapshot, result, and warnings. Later editor edits
cannot change the active run. A rejected new attempt preserves the previous
successful run and labels it as previous; errors/warnings remain visible.

PlaybackView consumes that run's result and festival snapshot. It supports
play/pause, restart/replay, speed and keyboard-operable scrubbing, including
empty, single, first, sparse, and final frames. The cursor ends at the last
recorded frame, which can precede the requested duration. Hidden-tab elapsed
time does not skip playback forward. All six current statuses and null targets
render safely. People use frame positions in meters converted only for display.

FrameDetails and PlaybackCanvas use frame-provided queueLength,
inventoryRemaining, and cumulativeSales. Waiting excludes active service;
cumulativeSales is purchase count, not revenue. Null inventory is Unlimited;
zero stock shows Out of stock. These are selected-moment playback values,
not independently calculated summary metrics.

## ANA-01: next backend task

Owner: Developer B. Implement `src/analytics/metrics/**` and adjacent tests,
with only the narrow engine composition needed to call the reducer.

Follow the existing [SIM-02 → ANA-01 handoff](./SIM-02-ANA-01-HANDOFF.md) for
the authoritative formulas, queue/service transitions, and invariant tests.
The temporary reducer is `src/simulation/events/reduce.ts`. Replace its
calculations with one analytics-owned implementation; do not leave duplicate
canonical reducers. Keep `runSimulation(festival, settings)` unchanged.

Return the existing SimulationResult.vendorMetrics and totals from ordered
events, never frames. Preserve causal event order, zero-demand vendor entries,
stable vendor-ID order, immutability, determinism, and JSON serialization.
Reconcile purchases/revenue, admitted queue visits, completed waits, abandonment,
maximum waiting queue, first stockout, and service utilization including run-end
truncation. Retain all SIM-02 conservation tests.

Playback needs no metric adapter or semantic change when ANA-01 lands. Prove
this by passing a real analytics-integrated run to the existing playback tests.
Do not change frame state, statuses, queue behavior, RNG, or shared fixtures to
make metrics tests pass. Domain/fixture changes require joint contract review.

## UI-03: dashboard task and dependency gate

Owner: Developer A. Implement `src/features/dashboard/**`, with narrow
composition alongside playback. The updated TASKS.md requires both ANA-01
and ANA-03 for the completed vendor-and-destination dashboard. ANA-03 follows
CON-02 and SIM-03. Vendor presentation can be prepared against current reviewed
fixtures, but do not mark the full task complete before destination contracts
and metrics exist. Do not invent destination fields or infer visits from dots.

Reuse the successful active run already held by PlaybackWorkspace. Compose
dashboard presentation using active.run.result and active.run.festivalSnapshot;
if state is lifted, preserve the ActiveRun snapshots and success/error behavior.
Do not run the engine again for a dashboard or read a live editor draft as the
metadata source for old results. No additional shared result contract is needed.

Display final result.vendorMetrics and result.totals directly. Resolve names
against the festival snapshot. Distinguish final-run dashboard summaries from
the selected-frame playback table: scrubbing must not rewrite final metrics,
and pausing animation must not hide dashboard results. Do not import analytics
reducers or calculate canonical metrics, revenue, waits, utilization, or lost
sales in the browser. Formatting supplied values is presentation only.

Provide labeled, keyboard-usable views with empty/no-run and zero-data states.
Handle null stockout time explicitly. Do not treat absent destination metrics
as measured zero before their contract lands. Charts must have readable text
or table equivalents and use explicit units. Results are modeled estimates,
not forecasts. Preserve warnings and previous-run identification on failures.

UI-03 tests should prove direct values from the shared fixture and a real
ANA-01 run, zero/null handling, snapshot metadata isolation, unchanged metrics
while scrubbing/pausing, visible warnings/errors, and no input mutation.
Add reviewed destination fixture coverage once CON-02/ANA-03 are available.

## Scope and known limitations

Price/budget-aware choice, bounded multi-stop itineraries, roaming, and
stage/amenity dwell belong to CON-02 → SIM-03/UI-04, then ANA-03 metrics.
They are not implemented by UI-02 or ANA-01. Do not silently add them here.
Current leaving/exited states do not identify why a guest left. Full-queue
rejections lack a canonical event; abandonment does not distinguish timeout
from stockout. Do not present those missing reasons as measured lost business.

Sparse recordings can produce position jumps. Engine queue coordinates can
overlap; UI does not invent separation or crowd-density metrics. Engine calls
are synchronous, so much heavier runs can block the browser. Exit markers and
custom areas remain visual annotations under the current contract.

## Verification baseline and merge gate

On the UI-02 implementation head:

- Targeted playback/simulation suites: 54 passing tests.
- `npm run verify`: 76 tests, lint, strict typecheck, and production build pass.
- Shared fixture and real SIM-02 runs across seeds 42, 7, and 99 pass; test-only
  event reconciliation verifies queues, inventory, purchases, and stockouts.
- Production browser smoke passes eight vendors/300 people, live updates,
  pause/scrub, finite/unlimited stock, snapshot isolation, and 390 px layout,
  without browser exceptions.
- Forced 300-person redraw measured approximately 60 FPS in local headless
  Chrome 157 on macOS arm64, exceeding the 30 FPS target on that machine.
  This is not a cross-device performance guarantee.

Run focused new tests plus `npm test -- src/features/playback src/simulation`
and `npm run verify` before each follow-up merges. Review diffs for ownership,
duplicate metric calculations, contract drift, and unrelated changes. Keep the
current playback integration green throughout analytics/dashboard work.
