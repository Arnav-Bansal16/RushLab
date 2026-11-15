# UI-04 integrated with merged SIM-03

## Current status and baseline

2026-11-14: UI-04 is compatible with merged SIM-03 for the public engine handoff,
canonical amenities, advanced controls and frame presentation. Full automated
verification passes. Draft review remains appropriate because the fresh 30 FPS
performance target and the complete manual acceptance checklist are unverified.
This is not a claim that ANA-03, UI-03, INT-01 or release hardening is complete.

- Feature branch: `codex/ui-04-behavior-controls`; never push to `main`.
- Fetched `origin/main`: `552883c` (SIM-03 implementation PR #8 and handoff PR #9).
  It includes the reviewed SIM-03 head `4777c9c` and handoff `7b62648`.
- Existing UI-04 work (`29c65b1`, `9e004bd`) was preserved. Main was merged into
  the feature branch as `dff0a1e`, without reset, force-push or copied engine code.
- Followed `docs/SIM-03-UI-04-HANDOFF.md`, current ARCHITECTURE, TASKS,
  TESTING, INTEGRATION, public contracts/defaults and reviewed fixtures.
- The earlier CON-02 baseline authorization still applies. The original review
  records were empty; this does not prove no approval occurred or create a new
  retrospective approval gate. No shared-contract/fixture changes were made.

## Integration changes

1. Canonical amenity lifecycle: new layouts initialize `amenities: []`; seating,
   restroom and first aid use approved `Amenity` objects. Existing create, move,
   resize, delete, undo/clear, `fromFestival` and JSON snapshot paths retain them.
   Missing amenities remain backwards compatible. Exits, parking and custom areas
   stay visual-only; historical annotations are not inferred to be destinations.
2. Stage/amenity attraction is visible/editable during creation and in the
   inspector. Amenity type is editable. Optional location dwell overrides retain
   explicit inheritance by removing the property when absent. Invalid drafts
   remain visible and cannot be applied. Contract/demo initial values are shown.
3. Advanced controls still use `DEFAULT_BEHAVIOR_SETTINGS` and the shared
   validator, with no independent normalization or behavior decisions. Each
   numeric leaf is covered by invalid/empty/nonfinite/boundary tests.
4. Zero weights for destination types present in the layout produce an input
   warning: guests will exit without a visit, and zero values are preserved.
   This checks input weights/types only; eligibility and all choices stay in the
   engine. Tests verify real safe exits and missing-type compatibility.
5. Playback draws all amenities, uses distinct stage/amenity colors and labels,
   and includes a text destination legend. Generic targets and all nine statuses
   continue to come directly from frames. Null/missing targets and supplied
   run-end positions remain safe; no event-to-frame reconstruction.
6. “Assumptions used by this run” displays `result.settings`, including fully
   resolved behavior returned by the engine. It never reads live controls or
   presents requested partial settings as the engine's resolved configuration.
   The validated input helper currently resolves behavior before execution too;
   completed-run presentation still treats the result as authoritative.
7. The SIM-02-era “prices/budgets/multi-stop/dwell not implemented” product copy
   is replaced with accurate modeled-assumption language. The eight-vendor
   example now contains a stage and all three amenity types. “Load behavior
   example” loads it into the editor for price/attraction/dwell editing.

## Data flow and ownership

There is one run pipeline: `prepareSimulationInput(layout, settings)` followed
by the public `runSimulation(input.festival, input.settings)` only when valid,
via existing `executeRun`/`ActiveRun`. Successful runs retain independent
festival/settings/result/warnings snapshots. Invalid reruns keep and identify
previous successful playback. Presentation never reruns the engine.

Code references:

- `src/features/editor/layout.ts`, `ComponentForm.tsx`, `BehaviorAttributes.tsx`,
  `FestivalEditor.tsx`, `simulationInput.ts`: editing and validated snapshots.
- `src/features/simulation-settings/BehaviorControls.tsx`, `warnings.ts`,
  `ResolvedAssumptions.tsx`: shared defaults/validation, input warning and
  engine-returned assumption display.
- `src/features/playback/PlaybackCanvas.tsx`, `PlaybackView.tsx`,
  `PlaybackWorkspace.tsx`, `vendorDemo.ts`: map presentation and composition.

No domain, fixture, engine, analytics, dashboard, comparison, recommendation,
package manifest or lockfile changes relative to fetched main. No new production
libraries. Imports use only the public simulation entry point. No frontend
choice, budget, dwell, queue, revenue, visit or other canonical metric formulas.

## Acceptance and source-by-source handoff audit

Every handoff currently present was read. The checklist was originally recorded
before UI-04 implementation in `29c65b1`; the matrix below revisits that checklist
against merged SIM-03. Historical passing tests and FPS numbers are not new
verification evidence. Complete means implementation plus current named evidence;
manual gaps remain explicitly pending below.

| Source | UI-04 requirement | Implementation and current evidence | Status |
| --- | --- | --- | --- |
| TASKS UI-04; HANDOFF; SIM-03-UI-04 | Vendor price/service create/edit, display units | ComponentForm/BehaviorAttributes; behavior.test creation and engine handoff; browser edited 8/5 then real run | complete |
| SIM-03-UI-04 | Canonical amenity initialization/create/edit/move/resize/delete/undo/clear/import/export | layout/input; amenities.test exercises all three types, geometry, retained undo state, JSON and missing-array import; browser type/attraction change applied | complete for implementation; exhaustive browser lifecycle audit pending |
| HANDOFF; ARCHITECTURE; SIM-03-UI-04 | Stage/amenity attraction/type and dwell overrides/inheritance | ComponentForm/BehaviorAttributes; amenities/behavior tests for attraction/ranges/absence; browser 10–5 rejected, 10–15 applied then inheritance restored | complete |
| HANDOFF; behavior.ts; SIM-03-UI-04 | Shared defaults, intent/destination/category weights, stop/revisit/roam/exit limits, dwell, queue tolerance and elasticity | controls; behavior.test default equality/every-field nondefault handoff; limits.test invalid cases for every numeric leaf | complete |
| INTEGRATION; SIM-03-UI-04 | Zero eligible weights accepted unchanged with warning; missing types/no destinations safe | warnings/input; sim03.integration real exits, no visit events, zeros retained, missing types and empty layout; browser zero-weight run displays warning | complete |
| HANDOFF; TASKS UI-04 | Empty/malformed/nonfinite/negative/range/integer validation and accessible feedback | string drafts/native creation errors/shared behavior validator; behavior/limits/amenities tests; browser invalid stop 7 retains prior result | complete; full manual keyboard audit pending |
| SIM-03-UI-04 | Fully resolved completed assumptions from result.settings | ResolvedAssumptions; sim03.integration partial input/edit isolation/default display; browser resolved 6-stop/first-aid weight 1 displayed | complete |
| SIM-01-HANDOFF; UI-02-ANA-01-UI-03-HANDOFF; SIM-03-UI-04 | Exact validated public-engine handoff, independent deep snapshots, no invalid execution | existing executeRun preserved; run/behavior/sim03.integration tests with real edited assumptions and subsequent mutation | complete |
| UI-02-ANA-01-UI-03-HANDOFF | Warnings/errors/no-run states; rejected attempt retains identified success | existing workspace/RunMessages; run/rendering tests and current browser rejected rerun | complete |
| SIM-01-HANDOFF | Blank draft; gate validation, multiple/gate-only layouts; annotations excluded | existing editor/input/vendorDemo integration suites rerun | complete |
| SIM-01-HANDOFF; SIM-02-UI-02-HANDOFF | World meters, complete sparse frames, absent unspawned/exited identity; last-frame boundary | unchanged controller/animation/AttendeeMarks semantics; controller/animation/rendering/sim02 integration tests rerun; browser first/final/midpoint scrub | complete |
| SIM-02-UI-02-HANDOFF; UI-02-ANA-01-UI-03-HANDOFF | Play/pause/restart/scrub/speed/background behavior | controller/animation/rendering suites rerun; browser pause/End/PageDown | complete |
| SIM-02-UI-02-HANDOFF | Waiting excludes service; purchases not revenue; null unlimited/zero stock | direct vendorDisplay/FrameDetails values; existing rendering/ledger reconciliation suites; browser counts/stockout/unlimited rows | complete |
| HANDOFF; CON-02; SIM-03-UI-04 | Generic targets, dwelling/roaming/all nine statuses, null/stale targets, accessible target names | presentation/FrameDetails; genericTargets fixture tests plus real sim03 integration frames for every destination type; browser guest target accessible | complete |
| SIM-03-UI-04 | Draw amenities distinctly, absent/empty arrays safe, final positions supplied by engine | AmenityMarks/AttendeeMarks and text legend; sim03.integration drawing checks, existing supplied-position test; browser map inspection | complete |
| HANDOFF; UI-02-ANA-01-UI-03-HANDOFF; SIM-03-UI-04 | Accurate modeled assumptions, never forecasts | workspace/settings/result copy; rendering assertions and current desktop/narrow inspection | complete |
| All handoffs; TESTING; SIM-03-UI-04 | Reviewed fixtures plus real stage/two-vendor/all-three-amenity run; determinism and compatibility | sim03.integration uses eight-vendor example, 250 attendees, edited UI-parsed settings and override snapshots; repeat equality; full backend invariant suites | complete |
| SIM-02-ANA-01-HANDOFF; UI-02-ANA-01-UI-03-HANDOFF | Final metrics not recalculated while scrubbing | unchanged result boundary; playback immutability tests; no dashboard exists at this base | complete for playback; dashboard outside UI-04 |
| TASKS UI-02; SIM-03-UI-04; TESTING | Fresh 300-attendee browser check/30 FPS target | current 300-guest/600-second run and scrub smoke pass; timing API unavailable | smoke complete; FPS unverified |
| SIM-02-ANA-01-HANDOFF; HANDOFF B | Queue/inventory/budget/event/metric formulas and simulation behavior | owning backend suites rerun; no UI reducers | not applicable to implementation: backend ownership |
| SIM-03-UI-04; TASKS ANA-03/UI-03/INT-01 | Destination summaries, dashboard, fair comparison/recommendations/deploy | separate tasks; returned destinationMetrics/destinationTransitions remain empty until ANA-03 | not applicable: outside UI-04 |

## Superseded historical statements

- Old UI-04 gate requiring proof of past joint approval is superseded by the
  explicit merged-CON-02 baseline authorization; approval evidence remains
  accurately described above.
- Three-stop prose is superseded by current behavior.ts/ARCHITECTURE/TASKS:
  overall default four, configurable one through six, per-type caps and revisits.
- Old HANDOFF/UI-02/editor/playback README descriptions of SIM-02-only behavior,
  six statuses, missing generic events and “SIM-03 not implemented” are historical.
  Merged SIM-03 and `docs/SIM-03-UI-04-HANDOFF.md` govern current integration.
- The new SIM-03 handoff's description that UI snapshotting still omits amenities
  described its pre-integration UI baseline; current UI-04 already retains them.
- Old all-zero fallback uncertainty is superseded for eligible destination weights
  by SIM-03's typed no_eligible_destination fallback. No frontend fallback added.

## Current verification

After the final implementation edit:

- Focused editor/settings/playback: **97 tests pass**.
- `npm test -- src/features/playback src/simulation`: **78 tests pass**.
- `npm run verify`: lint, strict TypeScript, **175 tests in 22 files**, and
  production build pass. Includes SIM-03 determinism, stream independence,
  queue conservation, inventory/budget and event/ANA-01 metric agreement suites.
- `git diff --check` passes; ownership/import/metric audit found no material
  cross-layer violation. Public contracts, shared fixtures and dependencies are
  unchanged relative to merged main.

New adjacent tests: `editor/amenities.test.ts`,
`simulation-settings/limits.test.ts`, `playback/sim03.integration.test.ts`.
Existing editor/settings/playback/simulation/analytics tests remain green.
Backend correctness assertions stay in owning suites; new frontend integration
checks verify the boundary and rendering, not reimplement business formulas.

## Manual browser evidence and remaining limits

2026-11-14, local development server, macOS Darwin arm64, ChatGPT in-app browser.
Browser version/exact hardware model were not exposed. Existing local dev server
was reused; a duplicate dev-server attempt exited without replacing it.

Verified in this integration session:

- Load behavior example: eight vendors, stage, seating, restroom and first aid.
- Change amenity type to seating and attraction to 0.8; apply and see its type
  reflected in the component list; restore restroom type.
- Empty dwell override shows field errors; 10–5 disables apply; 10–15 applies;
  unchecking override restores inheritance.
- Vendor price 8/service time 5 applied, then 300 guests/10 minutes/6 stops and
  first-aid weight 1 run successfully through merged SIM-03.
- Playback map visually shows differently colored amenity rectangles and stage,
  attendee positions and vendor stock badges; accessible guest detail shows
  engine target name. First, 360-second and final 600-second frames scrub safely.
- Resolved assumptions show saved 300 guests/600 seconds/6 stops and first-aid
  weight 1. An invalid new stop limit 7 preserves this run and labels it previous.
- All five destination-type weights zero: successful run with visible warning,
  no frontend substitution. Restored nonzero weights and ran again for preview.
- 390×844 viewport: document width 390, viewport width 390; no horizontal
  overflow. Settings/errors visually inspected; desktop viewport reset afterward.
- Browser error log query returned no errors during these checks.

Still unverified: exhaustive keyboard audit, browser vendor-creation flow,
stage-attraction creation/edit browser flow, complete browser amenity
move/resize/delete/undo/export cycle, and missing-type browser flow. Automated
coverage exists for related lifecycle/handoff cases; it is not a claim these
manual flows were completed.

Performance: fresh 300-guest playback smoke completed (300 frame identities at
final frame); **measured FPS unknown**. An attempted 121-sample animation-frame
cadence check failed because the browser tool's read-only evaluation scope does
not provide requestAnimationFrame (`TypeError: requestAnimationFrame is not a
function`). No valid rendering trace was collected; no 30 FPS claim and no old
number reused. A real browser performance trace remains a pre-merge check.

## What now works and next steps

The integrated app edits festival destinations/prices/service/dwell/behavior,
runs seeded price- and budget-sensitive bounded multi-stop visits, and plays
engine-supplied stage/vendor/roam/amenity/queue/service/dwell/exit states. The engine
returns event-derived vendor business metrics and a canonical destination ledger.
Outputs are modeled estimates, not forecasts or observed human behavior.

Important behavior distinction: SIM-03 queue patience timeout exits the festival
with queue_tolerance_exceeded; it does not automatically switch to another stand.
Stockout removal/admission rejection can return to the bounded next-choice flow.
A different timeout-to-another-stand policy would be separate simulation work.

Next: complete remaining manual/FPS checks and review UI-04; implement ANA-03
visit/dwell/transition metrics from events; UI-03 displays final vendor/destination
metrics; INT-01 compares compatible scenarios with common attendee assumptions;
then recommendations and release/demo hardening. UI must not fill empty
ANA-03 arrays with inferred frame-derived summaries.
