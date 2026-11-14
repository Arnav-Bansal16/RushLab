# UI-02 playback integrated with SIM-02

## Source and ownership

UI-02 includes main `5a98d8d`, including SIM-02 implementation `711e2c2` and
`docs/SIM-02-UI-02-HANDOFF.md`. No backend or shared-contract edits are made by
this feature. UI code imports only the public `runSimulation` export.

`PlaybackWorkspace` collects settings and invokes `executeRun`, which uses the
exact `prepareSimulationInput(layout, settings)` →
`runSimulation(input.festival, input.settings)` handoff. Invalid inputs block the
engine. Errors and input warnings are retained, including warnings for visual
exit/custom-area annotations. A failed attempt leaves any previous successful
run visibly identified. Festival/settings/result snapshots are independent of
later editor changes. Each successful run gets a fresh playback cursor.

## Frame semantics

- Binary search selects the latest complete saved frame at or before the
  presentation cursor. Empty, single, first, sparse and final frames are safe.
  The last available timestamp, not requested duration, bounds playback.
- Browser animation deltas move a presentation cursor only; playback never
  advances the engine. No wall-clock timestamps become simulation timestamps.
- No interpolation or invented arrivals, events, positions, status transitions,
  queues, inventory, purchases, revenue, waits, or utilization are calculated.
- Small person silhouettes use supplied meter positions and all six statuses.
  Exited identities remain faded for stable scrubbing. Null targets are safe.
- Vendor waiting count, stock, and completed purchases come directly from the
  selected frame. Waiting excludes in-service attendees; sales are purchase
  counts, not revenue. Null inventory displays Unlimited. Zero inventory shows
  Out of stock. The map and table share the same selected frame.
- Live/Paused and timestamp labels make the source moment visible. Scrubbing
  rewinds stock and purchase displays to the recorded state for that moment.
- ANA-01 owns final business metrics; UI-02 does not reconstruct them from events.

## Organizer workflow and example

Run controls emphasize guest count and duration in minutes. Technical settings,
recording diagnostics, attendee inspection, and precise editor coordinates are
optional disclosures. Dragging stays available. A one-click 8-vendor/2-gate
example runs 300 guests with the real engine and starts at 4× speed, preserving
the editor draft. The source layout is frontend example input in vendorDemo.ts,
not a modified shared fixture or fabricated set of attendee frames.

The example has varied modeled stock/service/counter/queue assumptions. Taco
Kitchen starts with three items so the example can exercise stockout. Other
vendors have finite or unlimited stock. All queue, purchase, timeout, and
stockout decisions are engine-owned. These illustrative inputs do not establish
real-world demand or lost-sales estimates.

## Tests and integration review

Targeted: `npm test -- src/features/playback src/simulation`.
Full gate: `npm run verify`.

Playback tests cover controls, empty/single/sparse/final frames, bounds,
all-status person rendering, null targets, direct vendor values, immutable
fixtures/results/snapshots, validation blocking, warnings, and real engine input.

SIM-02 integration tests exercise the editor handoff with 300 attendees and
seeds 42, 7 and 99. An independent test-only ledger check reconciles every frame
against queue_join, service_start, queue_abandon, purchase and exit events. It
checks waiting separately from service, finite/unlimited inventory, sales,
all six statuses, JSON round-trip, determinism, a real stockout with no later
purchase, source immutability, and sparse end times. Event reduction exists only
in tests, never in production UI. The upstream engine tests cover FIFO,
capacity, exact timeout boundaries, conservation, named streams, and stockouts.

## Performance and visualization limits

Prior isolated Chrome checks on macOS 27.2 arm64 measured ~60 FPS at 1280×900
with 300 person identities while repeatedly resizing the map by one pixel to
force redraw. This is a local headless presentation stress check, not GPU
profiling or a hardware/browser guarantee. The combined SIM-02 browser check
and its measured output are recorded in the PR.

Frames are deliberately sparse, so position jumps follow recording cadence.
Simulation invocation is synchronous. Queue members can share engine-provided
coordinates and overlap visually; UI does not invent queue-spreading positions.
Leaving alone does not identify whether a guest purchased, abandoned, or was
cleaned up at run end. The v1 contract has no event-exit-reason field, and exit
markers/custom zones remain visual annotations until a joint contract change.
No forecasts, comparison fairness claims, or lost-sales estimates are added.

## Combined browser verification after SIM-02 update

Full npm run verify passes 75 tests, lint, strict typecheck, and production build.
Targeted playback + simulation suites pass 53 tests. Browser smoke used the
actual 8-vendor / 300-guest engine result, inspecting seven timeline positions
from the first frame to 180 seconds. Waiting counts became positive, purchases
increased, and finite stock decreased. Taco Kitchen sold its three initial
items and remained at zero stock/three purchases after stockout. Coffee Corner
and Games Tent kept Unlimited inventory. Map badges and table rows followed
the same selected snapshot, including when scrubbing backward.

Final recorded purchase counts in the illustrative seed-42 example were:
Taco Kitchen 3, Pizza Oven 8, Coffee Corner 13, Fresh Juices 12, Burger Grill 3,
Ice Cream 7, Event Merchandise 3, Games Tent 6. These are the engine's recorded
counts for this example, not a revenue forecast or layout recommendation.

Live timestamps advanced while playing and stopped while paused. Editing the
organizer layout retained the active example snapshot. A 390 px viewport had
no horizontal overflow, and no page exceptions were observed. A repeated
300-person canvas redraw check in isolated headless Chrome 157 on macOS arm64
measured 60.00 FPS over 180 animation intervals. The screenshot was visually
inspected. This is a local measurement with the limitations noted above.

Integration review found no remaining material UI handoff violation. Engine
source, domain contracts, shared fixtures, analytics and dependencies match
origin/main. Business metrics/interpretation remain ANA-01 work; no browser-side
metric reducers or revenue calculations were introduced.
