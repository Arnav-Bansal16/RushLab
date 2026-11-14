# Editor → SIM-01 handoff

The venue builder owns `LayoutDocument`, a `Festival` plus an editor-only
extension for colors, labels, exit markers, and custom areas. Do not add these
fields to the jointly owned domain contracts as part of a frontend change.

For engine composition, use the existing callable signature:

```ts
import { prepareSimulationInput } from "@/features/editor/simulationInput";

const input = prepareSimulationInput(layout, settings);
if (!input.ok) {
  // Show input.errors and input.warnings; do not call the engine.
} else {
  // Keep input.warnings visible, especially unsupported exit/custom-area behavior.
  const result = runSimulation(input.festival, input.settings);
  // Playback reads result.frames. Dashboard reads result metrics.
}
```

`runSimulation` must be the real SIM-01 export when it exists. This editor does
not implement a fallback engine or generate simulated data. The contract test
uses an explicitly named test double, not a real engine integration test.

`prepareSimulationInput` clones only the approved `Festival` fields and settings.
It validates finite world-meter geometry, IDs, entrance weights, vendor service
settings, and basic P0 run settings. It requires an entrance before a run, while
a blank editor canvas remains valid for drafting. Default settings remain the
caller's responsibility. Seed, profiles, event calculations, and simulation time
remain engine responsibilities.

The separate "Export simulation JSON" button exports only a validated Festival;
"Export layout (PNG)" downloads a visual map image, including custom annotations.
The PNG includes the event name, site dimensions, and meter grid; it is not an
editable layout-data file.
The simulation export excludes visual-only exit/custom-area annotations. It does
not silently turn them into entrances, obstacles, or recommendations.

Paths are centerlines in meters with a meter thickness. The renderer and editor
use a shared stroked footprint so horizontal, vertical, and diagonal paths stay
consistent when moved/resized. Invalid nonfinite editor updates are rejected.

Exit-aware routing and custom-area behavior need a separate joint contract PR.
Collision avoidance and connected-path reachability are not validated by this
frontend input checker; confirm the real engine's requirements at integration.
No path is required here because the v1 contract does not require one.

The approved CON-01 contracts and fixtures are already merged into main.
Do not restore the removed sample playback as part of SIM-01 integration unless
requested. SIM-01 is developed separately on codex/sim-01-deterministic-engine.
This frontend branch does not include its implementation. Queue/inventory
conservation remain SIM-02 checks; no engine behavior is implemented here.
