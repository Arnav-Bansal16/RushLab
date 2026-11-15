# ANA-03 destination analytics and demo tuning handoff

Implemented and locally verified on 2026-11-14. Prepared for pull request
review; merge and both-developer approval are not implied by this document.

## Delivered behavior

`src/analytics/destinations/deriveDestinationMetrics.ts` consumes the ordered
event ledger and canonical festival snapshot. `runSimulation(festival, settings)`
now returns its destination arrays instead of empty placeholders. The public
signature and domain contracts are unchanged; there are no new dependencies.

- Include every vendor, stage, and supported amenity, even with no visits.
  Missing `festival.amenities` means an empty list. Preserve actual amenity types.
- `visits` counts destination visit starts, including unfinished visits.
- `uniqueVisitors` counts distinct attendee IDs starting each destination.
- `repeatVisits` counts starts after the attendee's first visit to that same
  destination and validates `isRepeatVisit`. Visits = unique visitors + repeats.
- `completedDwellSeconds` sums durations on non-truncated matching visit ends;
  `truncatedDwellSeconds` sums durations on truncated matching visit ends.
  These are aggregate person-seconds, not an average or clock timestamp.
- Transitions count consecutive visits per attendee, validating contiguous
  `visitOrder` starting at 1. They aggregate by from/to type, not destination ID.
  Vendor-to-vendor can mean two different stalls. A transition does not imply
  the attendee purchased at either stall.
- Destination rows sort by ID; transitions sort by fromType then toType,
  using locale-independent lexical comparisons. Events are never re-sorted.

Malformed ledgers fail explicitly for invalid/unordered times, unknown or
mismatched destinations, duplicate/overlapping starts, unmatched ends, invalid
visit order/duration/repeat flags, immediate duplicate destinations, visits after
truncation, and unresolved visits. Duration matching uses relative tolerance
1e-9, consistent with defensive floating-point reduction in ANA-01.

## Files included in this change

| File | Change |
| --- | --- |
| `src/analytics/destinations/deriveDestinationMetrics.ts` | Pure event-derived destination metrics and transition reducer with ledger validation |
| `src/analytics/destinations/index.ts` | Reducer export |
| `src/analytics/destinations/deriveDestinationMetrics.test.ts` | 39 focused and engine integration tests, including shared-fixture reconciliation |
| `src/simulation/runSimulation.ts` | Import and return destination reducer output in place of empty arrays |
| `src/features/playback/sim03.integration.test.ts` | Two approved assertions now expect populated destination arrays |
| `src/features/playback/vendorDemo.ts` | User-requested festival-demo patience, service-time and queue-capacity tuning |
| `src/features/playback/PlaybackWorkspace.tsx` | Update demo caption to twenty waiting guests per stall |
| `docs/ANA-03-HANDOFF.md` | This implementation and downstream handoff |
| `docs/TASKS.md` | Record ANA-03 implementation and next feature sequence |
| `docs/INTEGRATION.md` | Update destination-output integration status |
| `docs/UI-04-CONSOLIDATED-HANDOFF.md` | Distinguish historical UI-04 baseline from current ANA-03 continuation |

The integration base is main `21f0a2a`, which includes the prior UI-04
documentation consolidation in PR #12 (`45275cb`). That prior work is already
merged and is not a new implementation in this change.

## User-requested festival-demo tuning

This is a separate, explicitly requested demo configuration change included
with ANA-03. Global behavior defaults and the original stockout vendor example
remain unchanged.

| Setting | Previous demo | New demo |
| --- | ---: | ---: |
| Queue tolerance multiplier | 1 | 0.65 |
| Waiting capacity per stall | 8 | 20 |
| Base service time per stall | 30 seconds | 45 seconds |

Lower patience creates more long-wait departures; higher waiting capacity and
slower service produce visibly longer queues. The existing bounded queue
reselection, red frustration markers, missed-sale semantics and immutable
snapshots continue unchanged. Runs with these different settings must not be
presented by INT-01 as compatible layout-only comparisons without a warning.

A temporary deterministic audit of the 300-guest, 600-second festival demo,
seed 42, measured a peak waiting queue of 8 before and 20 after tuning, and
66 versus 177 abandonments. These are modeled demo results, not forecasts or
claims about every seed. The audit files were removed after inspection.

The production site was started locally on `http://127.0.0.1:3001`, and a
browser smoke check successfully loaded the page, started the demo, displayed
playing playback and verified the updated twenty-guest caption. This does not
replace the pending accessibility, full manual QA or FPS acceptance work.
Local preview server availability depends on the running developer session.

## Consumer guidance

UI-03 reads `ActiveRun.result.destinationMetrics` and `destinationTransitions`,
with names/types from `ActiveRun.festivalSnapshot` and resolved assumptions from
`result.settings`. Display zero-demand rows, and join by destination ID rather
than positional indexes. Final-run summaries stay fixed while playback scrubs.

Destination vendor visits count actual visit starts; ANA-01 vendor visits count
admitted queue joins. A full-queue rejection can therefore appear in destination
visits without becoming an ANA-01 queue visit. Vendor destination duration is
the whole visit interval, which may include waiting/service; it is not a new
queue-wait or utilization formula. Do not substitute these fields for ANA-01.
Truncation means the visit was still open at the final fixed simulation step.

The ANA-03 reducer alone does not alter attendee behavior, choices, queue retention, RNG, frames,
playback pacing, revenue, missed-sale opportunities, inventory, or budgets.
Existing canonical amenities, snapshots, generic targets and resolved settings
remain intact. There is no new dashboard in this task: current playback should
look the same. These outputs are modeled results, not forecasts.

## Verification

- 39 destination tests cover empty/missing destinations, all amenity types,
  first/last/zero-duration and run-end boundaries, repeats/unique visitors,
  attendee-local transitions, stable ordering, malformed ledgers, frozen inputs,
  serialization, same-seed runs, and exact engine-event reconciliation.
- Shared illustrative fixture values reconcile after sorting copies by the
  reducer's ordering rules; the fixture itself remains unchanged.
- Additional temporary audit compared the pre-ANA-03 composition with ANA-03 for
  eight 300-guest, 600-second demo runs (seeds 0, 1, 2, 7, 42, 123, 999,
  20261114). Every event, frame, attendee profile, setting, vendor metric and total
  was identical; only destination arrays changed. Temporary audit files removed.
- Full `npm run verify`: lint, typecheck, 221 tests in 26 files, production build.
  Repeated after demo tuning and caption correction. This is automated
  correctness evidence, not a full browser/FPS acceptance signoff.

## Shared-fixture ordering discrepancy for joint review

`multiDestinationSimulationResult` has matching values but groups destination
rows in illustrative vendor/stage/amenity order and transitions in illustrative
itinerary order. ANA-03 requires stable ID/type sorting. No contract or shared
fixture was rewritten. Both developers should review whether the fixture should
be reordered in a separate joint-owned change. Downstream consumers must use IDs
and types, not rely on the illustrative fixture's positional order.

## Next integration work

1. Review and integrate ANA-03, the focused UI-04 test expectation update, and
   the separately requested demo tuning. Do not treat demo configuration changes
   as changes to global model defaults.
2. UI-03: final vendor and destination dashboard from immutable ActiveRun data;
   distinguish final results from the selected-frame business panel.
3. INT-01: compare compatible settings and complete profiles, with explicit
   warnings/rejection for mismatches and historical queue-policy semantics.
   Schema version alone does not establish compatibility. Existing comparison
   delta contracts cover vendor metrics; adding public destination delta fields
   requires joint contract review.
4. ANA-02: evidence-backed placement/capacity recommendations after comparison.
5. Complete UI-04-QA and PERF-01 alongside feature work; then REL-01 preview and
   full demo hardening. Current runtime/FPS/payload acceptance is still pending.
