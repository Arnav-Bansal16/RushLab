# UI-03A final-results dashboard

Implemented on `codex/ui-03a-final-results`, based on latest fetched main
`5564969` (ANA-03 PR #14 merged; includes ANA-01, UI-04 and EXT-01).
This completes UI-03A implementation only, not full UI-03 or CP4.

## Changes and consumer boundaries

- `src/features/dashboard/FinalResultsDashboard.tsx`: shell accepting the saved
  successful ActiveRun, with separate FinalSummary, VendorResults,
  DestinationResults and DestinationTransitions presentation components.
- `src/features/dashboard/dashboard.css`: responsive summary and focusable,
  labeled horizontal table regions; all columns remain available.
- `src/features/dashboard/dashboard.test.ts`: seven focused fixture, real-engine,
  immutability, zero/optional-field and playback-independence tests.
- `src/features/playback/PlaybackWorkspace.tsx`: compose the dashboard alongside
  playback from `active.run`, including no-run and rejected-attempt states.

Summary renders canonical totals: purchases, modeled revenue, abandonments and
exited attendees. Run-level missed-sale totals are explicitly unavailable:
SimulationResult.totals does not supply them. No vendor sums are calculated.
Vendor rows render visits, queue joins, purchases, revenue, completed average
wait, maximum waiting queue, abandonments, utilization, first stockout and
optional missed-sale attempts/value. Destination rows render name/type,
visits, unique/repeat visitors and completed/truncated aggregate person-seconds.
Transitions render canonical from/to types and counts in supplied order.

Names, initial inventory/capacity, prices, service times and dwell overrides
come from festivalSnapshot. Resolved assumptions come from result.settings,
the engine's saved resolved settings, rather than partial requested settings or
live forms. executeRun and ActiveRun ownership are unchanged. The dashboard
has no cursor, timers, simulation calls, event/frame reads, analytics imports
or metric reducers. Playback state stays in the sibling PlaybackView.

Zeroes remain numeric zeroes. Absent missed-sale fields are Unavailable;
null stockout says No stockout recorded. Unlimited initial inventory/capacity
are explicit. Empty transitions have a readable empty state; absent legacy
destination arrays say unavailable. A successful result without frames still
renders all final metrics. Saved run warnings appear near the report; existing
attempt errors/warnings remain in the workspace. A rejected attempt retains
and labels the previous successful dashboard and playback.

Visible limitations qualify modeled estimates, missed-sale attempts and
opportunity values, queue frustration, nonvendor queues/congestion, and lack
of scientifically validated walkway/collision/safety/crowd-flow bottlenecks.

## Verification — 2026-11-14

- Targeted dashboard, playback, editor, ANA-01 and ANA-03: 17 files,
  122 tests passed.
- `npm run typecheck`: passed.
- `npm run verify`: lint, types, 27 test files / 228 tests and production
  build passed.
- Frozen input tests preserve snapshots, results, frames, events and profiles.
  Tests exercise playback reducer actions and compare unchanged dashboard
  markup; real browser checks below cover actual control composition.

Manual browser: ChatGPT in-app browser on macOS, localhost:3001, desktop
(default viewport) and explicit 390 × 844 narrow viewport. No physical mobile
or screen-reader device testing was performed.

1. Observed labeled no-run state; ran real 300-attendee festival demo.
   Final totals displayed 84 purchases, 469.00 currency units, 177
   abandonments and 300 exits; vendor, stage and amenity rows and transitions
   were present. First aid retained its zero visits/dwell row.
2. Paused, keyboard-scrubbed to end, replayed, restarted and changed speed.
   Compared full dashboard visible text before/after: unchanged.
3. Edited live event name and applied settings; attempted the empty live
   layout. Entrance validation error remained visible, previous result was
   explicitly identified, and saved report name/assumptions remained intact.
4. At 390 px, document width equaled viewport width (390 px). Vendor region
   was 286 px with 1441 px scrollable contents. Focus and ArrowRight produced
   horizontal scroll; native Tab reached the next report table. Focus outline
   was visible. Table headers, row labels, captions and units were exposed in
   the accessibility tree. Enter opened the saved assumptions disclosure.
5. Loaded behavior example, set zero guests and submitted using Enter.
   Zero totals/rows, absent optional missed-sale values and empty transitions
   displayed correctly. Native controls remained keyboard operable.
6. Saved-warning presentation was verified in automated rendering, not
   independently induced during browser smoke. No-frame and explicit stockout
   zero cases were also automated fixture checks.

## UI-03B remains after INT-01 and ANA-02 merge

The shell's optional React children is the narrow future report composition
point. Existing section components can be reused without a private comparison
or recommendation shape. No fake findings or comparison data were added, and
no shared contracts, fixtures or analytics formulas changed.

Remaining work:

1. Render canonical scenario comparison.
2. Display baseline, alternative, absolute and percentage deltas.
3. Display zero-denominator percentages as unavailable.
4. Render canonical issues, evidence, severity, thresholds, actions and limitations.
5. Render candidate changes and per-seed evaluations.
6. Present the best-tested candidate without claiming global optimality.
7. Load the canonical candidate Festival into the editor without mutation or
   an implicit rerun.

## Pitch presentation follow-up

Playback now precedes the final report. Recorded-moment statistics and guest
details are collapsed below the playback controls. The final report leads with
purchases, modeled revenue and abandonments, then compact vendor highlights.
All vendor metrics, destination activity/transitions and assumptions remain
available through native keyboard-operable disclosures. Unsupported run-wide
missed-sale cards were removed; per-vendor values and the explanation remain.
Numbers display at most one decimal place, currency two decimals; the saved
canonical results are unchanged.

## Sales-opportunity headline follow-up

At user request, Frustrated now is always visible below playback controls,
outside the recorded-moment disclosure. The abandonment headline is replaced
by Modeled sales lost (currency units), explicitly qualified as opportunities,
not actual lost festival revenue. Analytics-owned `totalMissedSaleValue` adds
supplied vendor values once during executeRun; ActiveRun retains the optional
aggregate. React only formats it. Any missing vendor evidence leaves the total
unavailable; explicit zeroes remain zero. No domain or shared fixture changes.
Full verification passes 229 tests, lint, types and production build.
