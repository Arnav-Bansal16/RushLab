# UI-04 consolidated handoff and next steps

Updated 2026-11-14. This is the current summary of UI-04, SIM-03 integration and
subsequent user-requested demo/queue changes. Use it with `TASKS.md`,
`ARCHITECTURE.md`, `INTEGRATION.md` and the public domain contracts. Older
handoffs retain detailed evidence but their draft/blocked status is historical.

## Current repository state

- Fetched GitHub main: `785ed94` — PR #11, queue-retention extension merged.
- UI-04 and its demo improvements merged through PR #10, merge `b044aab`.
- SIM-03 and its integration handoff were already merged through PRs #8/#9.
- Latest implementation head before these merges: `3fa38f2`. Its tracked tree
  matches fetched main. This documentation update does not change application code.
- GitHub review-list queries for #10 and #11 returned empty arrays. The merges
  are verified; attributable approval from both developers is not independently
  verified. Empty review lists do not establish that approval never happened.
  Do not invent a retrospective implementation gate. New shared changes still
  follow AGENTS.md's joint-review process.
- Previous automated PR attempts failed with connector 403. The verified PR
  merges above supersede the old “no PR exists” notes. No credentials were read
  by the rejected local-auth fallback, and this task does not retry that action.

## Delivered within the original UI-04 scope

| Area | What works | Main implementation |
| --- | --- | --- |
| Vendor controls | Create/edit average price and service time, explicit display-currency/seconds labels, finite bounded validation | editor/ComponentForm, BehaviorAttributes, layout |
| Destinations | Canonical seating/restroom/first-aid amenities; editable attraction/type; geometry/move/resize/delete/undo/clear and JSON snapshots | editor/layout, FestivalEditor, simulationInput |
| Dwell | Shared type defaults plus optional stage/amenity overrides; absent override stays absent and inherits in engine | editor forms, simulation-settings controls |
| Advanced assumptions | Intent/destination/category weights, overall/per-type/revisit limits, roam count, queue tolerance, elasticity, seeded post-stop exit and minimum remaining time | simulation-settings/BehaviorControls |
| Defaults/validation | Shared defaults and validator; empty drafts stay invalid, integer/range relationships enforced, accepted zeros preserved | domain/behavior consumed by UI |
| Zero eligible weights | Clear warning and safe engine handoff; no frontend normalization or invented fallback | simulation-settings/warnings, editor/simulationInput |
| Run isolation | Single validated prepareSimulationInput → runSimulation pipeline; deep snapshots; invalid rerun retains labeled prior success | playback/run, PlaybackWorkspace |
| Playback | Generic destination names, all engine statuses, safe null/missing targets and sparse-frame boundaries; stages/amenities rendered distinctly | PlaybackCanvas, FrameDetails, presentation |
| Resolved assumptions | Completed-run assumptions shown from result.settings, independent of later control edits | simulation-settings/ResolvedAssumptions |

All code paths remain in meters/fixed simulation seconds. UI does not select
destinations, advance simulation behavior, reconstruct frames from events, or
calculate canonical business metrics. Shared fixtures and production dependencies
were not changed.

## Work added after the original UI-04 request

The original task was a frontend control/presentation task. The following
extensions were explicitly requested during the demo iterations and are now
merged. They must be visible in planning, rather than treated as unfinished
SIM-03 or silently included in UI-03/ANA-03.

| Extension | Delivered behavior | Ownership/contract impact |
| --- | --- | --- |
| Complete demo | 300 guests, 10 simulated minutes, initial 1× speed; eight priced stalls; stage, seating, Bathroom and first aid; loadable editor example | UI example configuration; shared defaults unchanged |
| Visible exit | Marked main entrance/EXIT at the engine's real return location | Presentation of existing entrance routing; no separate exit-route contract |
| Queue demonstration | One server/stall, 30-second service, eight waiting spaces, unlimited stock; patience multiplier 1; no random post-stop exits, bounded six-stop/revisit settings | Explicit demo assumptions, not calibration or forecasts |
| Queue retention | Timeout, zero-patience rejection and full queue return guests to bounded destination choice instead of directly exiting | Simulation change beyond original UI-04; normal budget/time/eligibility/stop exits remain |
| Frustration cue | Engine-supplied red marker for 15 simulated seconds after a long/full queue; reason and rejected stall preserved | Optional QueueFrustration frame field; modeled cue, not observed emotion |
| Full queues | Map/table FULL labels reflect waiting capacity, excluding active service | Optional engine-supplied queueFull vendor-frame field |
| Missed opportunities | Each long-wait/full-queue attempt valued at that stall's average price, as selected by the user; timestamp/customer/stall/reason/value ledger | New missed_sale event and optional analytics vendorMetrics.missedSales |
| Simplified colors | Entering/choosing/walking/roaming/next-stop movement grouped blue as Walking; Queued amber; frustration red; leaving magenta; exited faded | Presentation grouping only; purchasing/dwelling remain real engine states, neutral gray and omitted from legend |
| Current frustration count | Number of red markers in the selected frame | Visual playback count; not a cumulative unique-person business metric |
| Business formatting | Short headings, consistent two-decimal display units, grouped counts, aligned numeric columns | Formatting supplied values only |
| Playback-paced statistics | Revenue/missed counts/value start at zero, follow frame time, pause/scrub/restart/rerun correctly; ledger hides future entries | Analytics-owned business timeline plus optional cumulativeRevenue/cumulativeMissedSales/cumulativeMissedSaleValue frame fields |

Actual revenue is earned purchase money, not profit. Missed-sale value is a
modeled stall opportunity per attempt, not actual lost festival revenue. One
person can abandon multiple stalls and later buy elsewhere. Do not deduct this
value from purchases, inventory, budgets or earned revenue; do not sum it into
an asserted festival loss. Stockout-only removals and ordinary festival exits
are not assigned invented purchases.

Changing patience no longer directly triggers a queue_tolerance_exceeded exit
in new runs; that reason remains compatible with historical results. A guest
can still exit if no legal next destination/time/budget/stop allowance remains.
The demo does not guarantee that nobody leaves or that every guest must wait.

## Current data flow and consumer guidance

```text
Editor Festival + requested settings
  → prepareSimulationInput (validate and clone)
  → public runSimulation
  → canonical purchase / missed_sale / destination / queue / exit events
  → analytics final metrics + event-derived business frame snapshots
  → ActiveRun snapshots
      → playback: selected SimulationFrame and matching business values
      → future dashboard: final SimulationResult metrics
```

`businessTimeline.ts` owns the shared business accumulator used for final
vendor values and recorded-moment snapshots. It walks ordered events once
across sparse frame timestamps. The UI reads frame values directly; no browser
price×sales formula, event sum or rerun is needed to update a table.

The old fixed-final-total demo table was superseded by the user's request for
statistics to match playback pace. Final metrics remain on result.vendorMetrics
and result.totals for UI-03. UI-03 must retain that distinction: a paused or
scrubbed playback must not alter a final-results dashboard.

Legacy frames without the new business values display Unavailable, not final
metrics or invented zeros. Older fixtures remain usable through optional output
fields. Schema-v1 inputs are unchanged. Contracts are in src/domain/simulation.ts;
do not create duplicate private interfaces in downstream features.

## Verification and outstanding acceptance

Latest implementation verification at `3fa38f2`: `npm run verify` passed lint,
strict types, **182 tests in 25 files**, and production build. The fetched merged
main has the same tracked tree. This documentation-only task has not rerun those
checks; the counts are dated implementation evidence, not a new test execution.

Relevant suites include editor/settings validation and lifecycle tests;
playback controller/animation/rendering/real SIM-03 integration; simulation
queueRetention and original determinism/conservation/inventory/budget suites;
analytics final ledger reconciliation and businessTimeline boundary/reset tests.

Browser checks performed during implementation: real 300-guest runs; vendor and
amenity edits; invalid rerun keeps prior success; zero weights; full queues and
frustration; 390px viewport without horizontal overflow; intermediate statistics
at 6:00, zeros after Restart, fresh rerun starts at zero. Browser/device was
ChatGPT in-app browser on macOS arm64; exact browser version/hardware unavailable.

Remaining, tracked as UI-04-QA and PERF-01 in TASKS:

- Complete keyboard and field-error accessibility audit.
- Complete browser vendor creation, stage-attraction and amenity
  move/resize/delete/undo/export lifecycle checks and missing-type smoke.
- Repeat narrow-layout inspection for the newly formatted statistics/ledger.
- Measure fresh 300-guest playback FPS, simulation runtime and payload budget on
  a named machine/browser. FPS is unknown: the automation evaluation scope did
  not expose requestAnimationFrame. No historical 60 FPS number is current proof.
- Run required CI/checks on integration before release and record evidence.

## What is not implemented yet

- ANA-03 destination visit/dwell/transition summaries: destinationMetrics and
  destinationTransitions remain empty; destination events already exist.
- UI-03 full vendor/destination results dashboard: the demo stall table is a
  playback panel, not completion of that task.
- INT-01 baseline/alternative comparison and compatibility warnings.
- ANA-02 evidence-backed recommendations, full performance signoff and REL-01
  deployment/demo hardening.

## Ordered continuation

1. Use fetched merged main, not an old SIM-02 or UI-only branch. Read this handoff,
   TASKS, ARCHITECTURE, INTEGRATION, TESTING and relevant owner-specific code.
2. Finish UI-04-QA and PERF-01; preserve and test the current reset/pacing behavior.
3. Developer B implements ANA-03 from ordered destination events, including zero
   destinations, truncation and stable ordering. Do not rebuild existing vendor
   revenue/missed-sale reducers or use frame-derived canonical counts.
4. Developer A builds UI-03 from the same ActiveRun result/festival snapshots.
   Clearly distinguish selected-frame playback figures from final-run metrics.
5. Joint INT-01 work compares common profiles, seed, duration, demand, behavior,
   dwell/queue assumptions and compatible model semantics. A queue-policy/model
   change between old and new saved results needs a visible warning or rejection;
   the schemaVersion alone does not prove behavioral compatibility. Choose that
   compatibility treatment in INT-01; it is not implemented by this handoff.
6. ANA-02 uses calculated evidence from compatible comparisons. Then REL-01
   verifies the complete preview/demo flow, disclosures and performance budgets.

Do not reimplement the queue extension because it was beyond original UI-04;
it is merged code. Track future behavior changes as explicit simulation/analytics
and joint-contract work, with the existing ownership and review rules.
