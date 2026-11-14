# UI-04 acceptance checklist and implementation handoff

## Status

Implemented for review on `codex/ui-04-behavior-controls`; draft PR required
because manual coverage and fresh performance verification remain incomplete.
This is not a claim that SIM-03, ANA-03, UI-03, or INT-01 is complete.

Baseline fetched on 2026-11-14: GitHub `origin/main`
`236028523928d8a7725f115713209d8bfbb0f688`. Existing branch work at `29c65b1`
was preserved. Main is already an ancestor; no reset or duplicate merge needed.
The acceptance matrix was recorded before implementation in `29c65b1`, then
updated before application edits to acknowledge the current authorization.

## Dependency evidence and superseded gates

- Complete: git history confirms merged UI-02 #3, SIM-02 #4, ANA-01 #6 and
  CON-02 #7 are ancestors of fetched main.
- Complete: use merged CON-02 as explicitly authorized in the current request.
  Fresh GitHub review and discussion queries for #7 returned empty arrays.
  Both-developer approval is not independently verified; empty records do not
  prove approval never happened and are not an additional implementation gate.
- Superseded: previous UI-04 checklist's retrospective approval gate is replaced
  by the user's merged-baseline authorization. No new contract/fixture edits.
- Superseded: historical three-stop requirement is replaced by current
  `docs/TASKS.md` UI-04/SIM-03, `docs/ARCHITECTURE.md`, and
  `src/domain/behavior.ts`: default four; integer one through six; default
  per-type two; revisits one by default, bounded by overall maximum.
- Complete for input acceptance: `validateBehaviorSettings` accepts all-zero
  intent, destination-type and vendor-category weights. UI preserves those zeros
  without normalization, substitution or invented choices. INTEGRATION specifies
  removal of missing types and safe exit for no eligible destinations.
- Unverified engine fallback detail: all-zero intent selection and all-zero
  eligible destination fallback are not specified fully by the current validator.
  SIM-03 owns that behavior; UI makes no fallback decision. Its absence does not
  block editing, validation, snapshotting or frame presentation.
- SIM-03 and ANA-03 are absent from fetched main. The present engine saves
  resolved settings but does not implement price-sensitive multi-stop behavior.

## Implementation

- `src/features/editor/ComponentForm.tsx`, `layout.ts`: vendor price/service
  creation, optional stage/amenity dwell creation, bounds/order validation;
  initial vendor values come from the reviewed demo fixture, and new amenity
  attraction comes from the reviewed multi-destination amenity fixture. Existing blank
  layouts remain supported. New restroom, seating and first-aid components use
  approved Festival amenities; parking/custom/exits remain annotations. Historical
  editor annotations are not automatically converted into destinations.
- `BehaviorAttributes.tsx`, `FestivalEditor.tsx`: explicit apply for vendor
  assumptions and location overrides. Empty/invalid string drafts stay visible,
  disable apply and leave committed layout values intact. Inheritance removes
  the override property; the UI does not resolve dwell timing. Undo/switching
  synchronizes the assumption editor with committed values.
- `src/features/simulation-settings/BehaviorControls.tsx`: all approved numeric
  behavior fields, including category weights, exit probability, remaining time,
  bounded roam count and dwell endpoints. Defaults are read directly from
  `DEFAULT_BEHAVIOR_SETTINGS`; public validation owns bounds and relationships.
  Empty strings become invalid NaN for rejection, never valid zero. Shared
  validation messages identify the invalid field/range and are associated with
  controls. Values are not normalized.
- `simulationInput.ts`: amenities retained, price/service/dwell bounds checked,
  public behavior resolver/validator called before execution, resolved settings
  deeply cloned. `executeRun` remains the only pipeline, with independent
  festival/settings/result/warnings and retained prior success on rejection.
- `MapCanvas.tsx`: approved amenities use existing map presentation/drag handling.
- Playback generic targets/status styles already existed on merged main.
  `presentation.ts` now honors explicit null generic targets instead of selecting
  a legacy vendor target. Missing IDs are displayed as supplied IDs. No inferred
  destination, behavior adapter, event reconstruction or canonical metric math.

## Audited acceptance mapping

Every handoff present at the baseline was read: HANDOFF, SIM-01-HANDOFF,
SIM-02-UI-02-HANDOFF, SIM-02-ANA-01-HANDOFF,
UI-02-ANA-01-UI-03-HANDOFF and the existing UI-04-HANDOFF. No separate
CON-02, SIM-03 or ANA-03 handoff exists at this baseline. Historical claims and
performance numbers are not current verification evidence.

“Complete” below refers to implementation plus named automated evidence;
manual gaps are listed separately and remain pending.

| Source | Requirement | Implementation/evidence | Status |
| --- | --- | --- | --- |
| TASKS UI-04; HANDOFF A | Vendor price/service creation/editing, display units | ComponentForm/BehaviorAttributes; behavior.test creation and edited handoff; browser edited 23/15 then ran | complete |
| TASKS UI-04; HANDOFF; ARCHITECTURE | Optional stage/amenity overrides, inherited absence, ordered endpoints | forms/layout/input; behavior.test override rejection and absent inheritance; browser stage 20–10 rejected, 20–30 applied | complete |
| HANDOFF; domain/behavior | Shared defaults, every advanced field, stop/revisit/roam/exit settings | BehaviorControls/readBehavior; behavior.test default equality and every-field nondefault engine handoff | complete |
| HANDOFF; INTEGRATION | Relative tendencies, accepted all-zero input, no frontend fallback | controls copy; zero-weight test and browser zero-intent run | complete for UI; engine fallback unverified |
| HANDOFF; TASKS UI-04 | Empty, malformed, nonfinite, negative, integer/count/range limits | string drafts/public validator; behavior.test invalid weights, prices/service, range and caps tests; browser invalid 7 stops | complete |
| HANDOFF; UI-02-ANA-01-UI-03-HANDOFF | Accessible errors, units and modeled-estimate copy | labels/descriptions/aria-invalid; default rendering tests; browser copy and Tab focus | complete; full keyboard audit pending |
| SIM-01-HANDOFF | prepareSimulationInput then public runSimulation, never execute invalid input | simulationInput/executeRun; run.test and behavior.test engine spies | complete |
| SIM-01-HANDOFF; UI-02-ANA-01-UI-03-HANDOFF | Deep independent snapshots; no mutation of defaults, editor or result | existing executeRun retained; run.test and behavior.test nested mutation checks | complete |
| UI-02-ANA-01-UI-03-HANDOFF | Prior success retained/identified; warnings/errors/empty states preserved | PlaybackWorkspace unchanged run flow; run/rendering tests; browser rejected rerun note | complete |
| SIM-01-HANDOFF | Blank drafting, gate validation, multiple/gate-only layouts, annotation exclusion | existing editor/input tests; new approved amenities retained; vendorDemo integration tests | complete |
| SIM-01-HANDOFF; SIM-02-UI-02-HANDOFF | Meter positions, complete sparse frames, absent unspawned/exited identity, last recorded frame boundary | existing controller/animation/rendering and sim02.integration suites rerun | complete |
| SIM-02-UI-02-HANDOFF; UI-02-ANA-01-UI-03-HANDOFF | Play/pause/restart/scrub/speed/background behavior | controller/animation/rendering suites rerun | complete |
| SIM-02-UI-02-HANDOFF | Direct waiting queue/sales/inventory values; null unlimited vs zero stock | existing FrameDetails/vendorDisplay; rendering and sim02.integration tests | complete |
| HANDOFF; CON-02 fields | Generic destination, dwelling, all nine statuses, null/missing IDs | presentation and genericTargets.test with reviewed multiDestination fixture | complete for contract presentation; real SIM-03 unverified |
| HANDOFF; SIM-01-HANDOFF | Only approved destinations; no inference from gates/parking/paths/custom/exits | layout mapping; genericTargets test; diff inspection | complete |
| SIM-02-ANA-01-HANDOFF; UI-02-ANA-01-UI-03-HANDOFF | Final result values stable during playback; no UI canonical calculations | existing result boundary retained; playback tests; no dashboard implementation exists in this baseline | complete for existing playback; dashboard task not applicable |
| All handoffs; TESTING | Reviewed fixtures and real public engine result compatible | genericTargets/rendering/run/sim02.integration suites | complete for current engine |
| TASKS UI-02; UI-02-ANA-01-UI-03-HANDOFF | Fresh 300-attendee/circle 30 FPS measurement | no new measurement; old number deliberately not reused | pending |
| SIM-02-ANA-01-HANDOFF | Event reduction, conservation, inventory, canonical formulas | backend-owned suites only; no frontend duplication | not applicable: separate backend ownership |
| HANDOFF B | Intent/choice/affordability/roam/dwell/queue behavior and typed exits | SIM-03 owns engine implementation | not applicable: UI-04 does not implement engine behavior |
| HANDOFF; UI-02-ANA-01-UI-03-HANDOFF | ANA-03/UI-03/INT-01/recommendations/deploy | downstream tasks retain their dependency gates | not applicable: outside UI-04 |

## Verification

Commands executed on this change:

- Focused editor/settings/playback: 56 tests pass.
- `npm test -- src/features/playback src/simulation`: 55 tests pass.
- `npm run verify`: passes lint, strict typecheck, all 115 tests (17 files), and production build after the final implementation edit.

New tests cover parsed defaults, every-field nondefault settings handoff,
zero weights, rejected numeric/range/count input, vendor creation, price/service
handoff, nested snapshot isolation, inheritance, invalid overrides, amenity
geometry/deletion, reviewed generic frames/statuses/null/missing targets.
Existing suites cover playback boundaries, controls, warnings and real engine
results. Backend invariants remain in their owning suites.

## Manual checks and limitations

2026-11-14, local Next development server, macOS Darwin arm64, ChatGPT in-app
browser (browser version and exact hardware model not exposed by this session).

- Complete: reviewed example loaded; vendor selected; price 23/service 15
  applied; real public engine run renders playback.
- Complete: invalid overall stop limit 7 displays shared error and preserves
  previous successful playback with explicit previous-run label.
- Complete: stage inheritance displayed; empty override endpoints show errors;
  20–10 ordering rejected; 20–30 applied.
- Complete: all four intent weights set to zero and a run accepted. This proves
  acceptance/rendering only, not the absent SIM-03 fallback implementation.
- Complete: modeled-assumption copy visible; desktop advanced grid visually
  inspected; keyboard Tab advances from overall to vendor stop control.
- Pending/unverified: full keyboard audit, vendor creation browser flow,
  amenity override/inheritance browser flow, all-zero eligible destination
  browser case and missing-type browser case. Automated input/integration
  coverage exists, but these manual flows were not completed in this session.
- Pending/unverified: narrow/mobile viewport was not exercised; only the
  current desktop in-app viewport was inspected. Responsive grid uses auto-fit,
  but CSS inspection is not a mobile browser verification claim.
- Pending/unverified: fresh 300-circle performance measurement. Method not
  performed; measured FPS unknown. Browser automation here supplied UI/DOM
  observations, not a timed rendering trace. No old FPS number reused.
- Unverified: real engine generic dwelling/price elasticity integration,
  because SIM-03 is not merged. The reviewed fixture verifies presentation.

## Downstream and diff audit

Domain, fixtures, simulation, analytics, dashboard, comparison, recommendation,
package manifests and lockfiles are unchanged. No production dependency added.
No canonical metrics or simulation decisions are calculated in UI. Browser
elapsed time still moves only the playback cursor. Generic target fallback
uses only the frame contract; the UI never chooses a replacement destination.

UI-04 implementation is ready for draft review with the pending manual checks
above. SIM-03 behavior, ANA-03 analytics, INT-01 fair comparisons and release
readiness require their own work and verification. Do not merge while required
manual/performance checks remain unverified.
