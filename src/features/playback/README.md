# UI-02 recorded playback

`PlaybackWorkspace` is mounted by the editor. It collects run settings and calls
`executeRun`, which uses the exact `prepareSimulationInput(layout, settings)` →
`runSimulation(input.festival, input.settings)` boundary. Only the public engine
export is imported. Invalid input never reaches the engine. Validation/engine
errors retain input warnings; a failed attempt leaves any prior successful
result visibly labeled as such.

An active run retains independent copies of festival, settings, result, and
warnings. Each successful run remounts `PlaybackView` with a fresh presentation
cursor. Later editor changes do not mutate the active snapshot or its data.
The editor remains usable while results are paused.

## Frame semantics

- The controller consumes saved `SimulationFrame[]` only. Binary search selects
  the latest frame at or before the presentation cursor, bounded to the first
  and final available frame. It does not assume the final time equals duration.
- Browser animation deltas advance the presentation cursor, never the engine or
  simulation state. No wall-clock timestamps are interpreted as simulation time.
- Rendering is deliberately discrete: no position interpolation, invented
  arrivals, status transitions, events, queues, inventory, sales, or metrics.
- Unspawned attendees remain absent. All six statuses render; exited identities
  remain as faded circles and can still be selected when scrubbing.
- Null targets display "No target vendor". No replacement target is chosen.
- Vendor waiting count, inventory, and completed-purchase count come directly
  from the frame. Unlimited inventory is `null`. Purchases are not revenue.
- No event reconstruction, metric reducers, or SIM-02 business logic exist here.

## Verification

Targeted tests: `npm test -- src/features/playback`.
Full gate: `npm run verify`.

Tests cover empty/single/sparse/final frames, controller play/pause/restart/scrub/
speed behavior, bounded cursors, all attendee statuses and null targets, direct
vendor values, frozen shared-result rendering, snapshot isolation, validation
blocking, warning presentation, and the real public engine feeding playback.
Shared fixtures and contracts remain unchanged.

Browser smoke checked the initial no-run state, invalid gate/settings input,
warnings on rejection and success, 300-attendee real engine output, play/pause,
speed selection, keyboard End/replay/restart, retained editor/run separation,
and a 390 px mobile viewport with no horizontal overflow. The desktop screenshot
was visually inspected. No page exceptions were observed.

### 300-circle measurement

Test machine: macOS 27.2, arm64, isolated headless Chrome 157.0.8103.52,
1280 × 900 viewport. All 300 attendee identities were present in the selected
real engine final frame, including faded exited attendees.

Over 180 requestAnimationFrame intervals (2999.834 ms), the check alternated map
width by one pixel to force repeated ResizeObserver/canvas redraws with all 300
circles. Observed presentation cadence: **60.00 FPS average**, **16.7 ms p95**
frame interval. Canvas fill instrumentation observed 109,495 fill calls during
the measurement. The local check meets the 30 FPS target.

This is a short headless redraw stress check, not a GPU timing benchmark or a
hardware/browser guarantee. Sparse engine frames remain sparse; 60 Hz controls
and canvas rendering do not imply 60 simulation snapshots per second. Discrete
position jumps are intentional in this slice. Run calculation is synchronous;
longer/heavier simulations may block the browser until the engine returns.
SIM-01 currently supplies movement; nonzero commerce state depends on SIM-02.

No production dependency was added. Browser automation used a temporary
Playwright installation outside this repository and a temporary Chrome profile.

## Organizer usability follow-up

A one-click 8-vendor market example now runs 300 guests through the real public
engine and opens playback automatically at 4× speed. It uses a separate planning
layout and preserves the organizer's editor draft. The input layout is declared
in vendorDemo.ts, outside the shared fixtures; no attendee frames are fabricated.

The main run controls are guest count and preview length in minutes. Seed, step,
recording interval, and walking speed remain in a closed Advanced settings panel.
Recording diagnostics and individual-attendee selection are optional disclosures.
Guest descriptions no longer show coordinates, and editor X/Y fields are inside
optional precise-positioning controls. Map dragging remains available.

The example is labeled as a movement preview. Queueing and purchase behavior
remain engine-owned SIM-02 work; zero placeholder business values are not
presented as evaluated business outcomes.

Follow-up verification: 16 targeted playback tests and all 48 repository tests
pass, including real-engine coverage of all eight vendor destinations. Isolated
Chrome 157 browser smoke confirmed one-click autoplay, 4× speed, 300 final guest
identities, eight vendor rows, preserved blank editor, hidden advanced controls,
closed attendee inspection, and no horizontal overflow at 390 px. The example
playback screenshot was visually inspected; no page exceptions occurred.
