# UI-03B — layout issues, bounded evaluation and comparison

Implemented and locally verified 2026-11-14. UI-03B is complete on the supplied
implementation base. This does not accept full CP4, PERF-01, release or deployment.

## Base and change isolation

UI-03A was present as uncommitted dashboard/workspace/run/playback changes,
including its sales-opportunity follow-up. ANA-02 and INT-01 exports, public
contracts, implementations and integration tests were present. Read the current
architecture, UI-03/CP4 task, integration guidance, all requested handoffs and
installed Next.js `use-client` documentation before implementation.

Existing work was retained. Nothing was staged, committed, reset or deployed.
In particular PlaybackView.tsx, playback/run.ts, the analytics-owned
`totalMissedSaleValue` files, existing dashboard components/tests and UI-03A
handoff were not rewritten by this task. Workspace composition extends the
existing uncommitted UI-03A integration. No domain/fixture, engine/analytics,
package, dependency or shared-contract changes were made.

## Changed files and integration points

- `src/features/dashboard/LayoutReport.tsx` (new): issue evidence; explicit
  evaluation; generation/ranking states; exact candidate changes; objective
  components; retained per-seed comparison tables; explicit candidate loading.
  Presentation components consume shared contracts directly.
- `src/features/dashboard/layoutReport.test.ts` (new): nine focused tests for
  canonical rendering, semantic value states, compatibility, one-sided entities,
  sparse transitions, unavailable evidence, ranking/failure states, frame-free
  end-to-end analytics evidence and independent editor conversion.
- `src/features/dashboard/dashboard.css`: additive report wrapping/disclosure
  spacing, visible keyboard focus and readable table omission reasons.
- `src/features/playback/PlaybackWorkspace.tsx`: narrow optional
  `onLoadCandidate(Festival)` callback; keyed LayoutReport through the existing
  FinalResultsDashboard `children` composition point.
- `src/features/editor/FestivalEditor.tsx`: callback commits an independent full
  canonical Festival through `fromFestival`, preserves undo history and clears
  selection. No merge with the live draft, clamping or implicit run.

## State and canonical ownership

Issues use `buildIssuesReport(active.run.result)` once at report mount.
Evaluation calls `optimizeLayout(active.run.result)` only from the explicit
button. No draft, playback cursor/frame or requested form settings enter that
call. Output retains canonical issues, generation, seeds and ranking. All raw
comparison rows come directly from retained `pair.comparison`; there is no
recomparison, UI scoring, averaging, aggregation or delta calculation.

The report is keyed by successful run ID. A new successful run remounts it;
rejected attempts retain the previous report and its existing previous-result
label. Editor changes and playback controls do not regenerate evidence.
Evaluation is synchronous, with candid blocking copy and measured elapsed
browser time, not simulated/background progress. A ref guards duplicate entry;
a completed report disables resubmission, and an exception offers explicit retry.

Candidate selection uses `bestTestedId` to find the canonical generation
snapshot. Loading passes a structured clone; the editor conversion clones
again. Saved ActiveRun, candidate output and playback are untouched. Saved
resolved assumptions remain accessible in the existing disclosure, and loading
warns that live form settings may differ and must be reused for a compatible
rerun. Loading intentionally does not alter settings or run a simulation.

Ranking order, exact ties, improvement ID and eligibility come from ANA-02.
Scores may be negative or zero. Per-seed objectives expose direction, weight,
normalization, raw values, contribution and omission reasons; valid comparison
evidence remains available after objective failure. Incompatible pairs show
structured errors and no comparison metric groups or seed objective score.

Available positive/negative/zero values are formatted directly. Not applicable
and Unavailable retain readable reasons. Physical one-sided entities retain
presence/absence; sparse transition counts retain INT-01 zero and warning.
All comparisons identify the inspected seed, without suggesting an average.
Capacity costs, model limitations, attempts versus people, modeled frustration,
nonqueued amenities and the non-confidence-interval seed suite stay visible.

## Verification

- Targeted dashboard/editor/playback/ANA-02/INT-01 run: 18 files, 112 tests
  passed before two additional one-sided/empty-evidence regressions were added.
- Final `npm run verify`: lint, strict types, **282 tests / 32 files**, production
  webpack build passed. This includes shared-fixture final results, playback
  lifecycle, simulation invariants and ANA-02/INT-01 integration tests.
- `git diff --check`: passed.
- Real test integration strips every baseline frame, runs ANA-02, renders its
  retained INT-01 comparison and converts the selected full Festival to an
  independently editable layout; input serialization remains unchanged.

Browser: ChatGPT in-app browser on macOS, existing local Next.js development
server at localhost:3001, default 1280 px desktop and explicit 390 × 844
viewport. No physical phone or screen-reader test. Temporary viewport reset.

Observed checks:

1. Ran real eight-vendor/300-attendee, 600-second demo. Final report retained
   84 purchases, 469.00 modeled revenue and 977.00 modeled opportunity value.
2. Explicit keyboard evaluation produced four candidates over seeds 42/43/44;
   best-tested added a second server at Taco Kitchen. Supplied aggregate score
   displayed 0.027544. Seed 42 displayed purchases 84 → 93, revenue 469 → 509,
   abandonments 177 → 173, zero exit delta and a worsening frustration objective
   contribution (-0.000667). No metric was recomputed by the UI.
3. Opened per-seed evidence using Enter. Inspected warning for seed 43's sparse
   vendor-to-seating transition and vendor no-stockout Not applicable states.
4. Loaded candidate using click and keyboard. Editor event/layout changed,
   selection cleared and loaded status appeared; completed final totals,
   report and paused playback remained present. No simulation started.
5. Changed editor name and applied settings; compared report visible text:
   unchanged. Restarted playback: report text still unchanged.
6. Rejected a rerun with negative attendee count: prior report text remained
   byte-identical and previous-success label was visible. A fresh successful
   demo run cleared candidate output and restored the explicit evaluation action.
7. At 390 px, document width equaled viewport width (390). A vendor comparison
   region was 244 px wide with 939 px contents; focused ArrowRight scrolling
   advanced scrollLeft to 40. Disclosures, evaluation and loading support Enter,
   and visible load-button focus was observed on desktop.

Measured synchronous candidate evaluation: **2196.9 ms** for the 300-attendee
example in this development browser. The call occupies the main thread and
blocks interaction during execution; rendering follows it. This single local
observation is not a PERF-01 budget decision, production benchmark or guarantee.

## Remaining boundaries

Full performance acceptance, cross-device/screen-reader audit, human UX review,
full CP4 integration acceptance and release/deployment remain separate work.
The existing synchronous analytics API and bounded search are unchanged; no
workers, persistence, exports, network calls or dependencies were added.

## User-requested presentation and frustration-demo follow-up

The issues report now leads with one plain-language summary card per supplied
issue category, affected names and canonical suggested next steps. Original
ordered findings, numeric evidence, thresholds, unavailable reasons and
limitations remain under a single detailed-evidence disclosure. No new issue
rules or remedies are calculated in React.

The best-tested candidate now leads with a before-and-after results report:
exact proposed changes, explicit seed selector, canonical festival totals and
service/opportunity metrics for affected vendors. Full ranking/objective/per-seed
information remains in a disclosure. The summary only describes improvement
when ANA-02 supplies improvingId, retains warnings and unavailable states, and
explains that tested changes have not automatically changed the completed run.

At the user's request, the illustrative festival demo now uses 60-second vendor
service (previously 45) and a 0.35 patience multiplier (previously 0.65). These
are visible demo inputs, not changes to engine policy or shared defaults.
Lower patience can reduce completed-wait averages by causing earlier departures;
slower service is the controlled input, not a fabricated measured wait.
Existing saved runs keep their original assumptions until an explicit rerun.

Verification: targeted dashboard/demo suites passed 21 tests; final verify
passed lint, types, 284 tests in 32 files and production build. New regression
runs both assumption sets through the public engine and confirms more canonical
modeled frustration/missed-sale attempts and identical attendee profiles.
Real browser seed 42: baseline 64 purchases / 353 modeled revenue / 300 queue
departures; selected candidate 73 / 398 / 280. Taco Kitchen average completed
wait 52.777778 → 41.921053 seconds. Results are per-seed modeled estimates.
Browser seed selector checked 42 → 43 → 42; 390px document width stayed 390px.
Desktop and narrow summaries inspected; detailed evidence remains accessible.

### Readability and fivefold patience follow-up

Issues now use a semantic Issues / Locations / Solution to test table grouped by
identical supplied suggested action. Each shared solution appears once in the
summary; full finding-to-entity evidence is preserved in the detail disclosure.
The evaluation action now explicitly says “Show before & after estimates”, with
an explanatory empty state. Its primary report says “Before & after estimates”
and uses Before / After (tested) / Change columns, with two-decimal presentation.
Values remain retained canonical comparison output, not invented projections.

Demo patience reduced fivefold again, 0.35 → 0.07; service remains 60 seconds.
The regression now compares those exact patience inputs at identical service
and validates increased modeled frustration attempts with unchanged profiles.
Browser reran the demo and evaluated: seed 42 purchases 62 → 67, modeled revenue
346 → 366, queue departures 426 → 436 (worsening preserved). Affected vendor
purchases 9 → 15, departures 53 → 48, completed wait 3.90 → 5.68 seconds. The
candidate improves ANA-02's aggregate objective; this does not mean all metrics
or all issues improve. The 0.35 baseline had 300 departures under this seed.
The user-facing browser was left showing the new before/after report.

### Permanent compact comparison (user override)

The user's latest instruction supersedes the earlier explicit-evaluation UX:
comparison now runs automatically inside PlaybackWorkspace.startRun after each
successful baseline run. Evaluation output/error are saved with that successful
run, so rejected attempts, editor edits and playback preserve it. Optimization
failure retains the successful simulation with a readable unavailable state.
There is no evaluation button, progress copy, runtime display or seed control.
The synchronous search adds its runtime to the Run action; no worker was added.

“Before and after” stays expanded and shows only purchases, modeled revenue,
modeled sales lost and the affected vendor's average completed queue wait.
The sales-lost cells use the existing analytics-owned totalMissedSaleValue
boundary for each retained seed result. No reducer, delta or scoring formula
was introduced in React. Queue-wait change is the supplied INT-01 vendor delta;
it explicitly says more/less/no change without asserting a reduction when
modeled wait worsens. Detailed canonical evidence remains in its disclosure.

Browser auto-run check: no second evaluation action; seed 42 displayed purchases
62 → 67, modeled revenue 346.00 → 366.00, modeled opportunity value 2,286.00 →
2,370.00 and Taco Kitchen completed wait 3.90 → 5.68 seconds (+1.78, more waiting).
All four rows were inspected in the permanent summary. Final verify passed
284 tests, lint, typecheck and production build; git diff --check passed.

### Removed loading and introduced an explicit higher-capacity what-if

At the user's request, removed the complete candidate-loading section, button,
loaded-status state and narrow editor/workspace callback wiring. The editor
and saved baseline continue to operate independently.

The after column now tests a documented higher-service-capacity scenario at all
vendors: four times each server count, capped at the supported 100. This is an
explicit scenario assumption, not a claim that all metrics can be improved by
editing displayed numbers. Prices, service duration, queue limits, patience,
seed, attendee profiles, festival geometry and demand remain unchanged.
Additional capacity/staffing cost is not modeled and is stated in the report.

New `features/dashboard/evaluateCapacityScenario.ts` composes the existing
shared LayoutCandidate/LayoutOptimization contracts and canonical ANA-02
validation/evaluateCandidates/three-seed ranking/retained INT-01 comparisons.
It does not change the bounded optimizer, engine, analytics formulas, shared
contracts or fixtures. Workspace automatically evaluates this one named
scenario after success; failure still preserves the baseline. It is best-tested
only within this single scenario, not a general optimum.

New regression `evaluateCapacityScenario.test.ts` exercises real 300-attendee
runs, exact retained comparisons, profile/settings equality, input immutability,
all four requested result directions for the demo, visible capacity assumption
and removal of loading controls. Tests preserve the possibility of unavailable
optional evidence rather than forcing it to zero.

Browser demo seed 42: purchases 62 → 201; revenue 346.00 → 1,110.00; modeled
opportunity value 2,286.00 → 1,201.00; Taco Kitchen completed wait 3.90 → 3.45
seconds (canonical delta displayed -0.45 seconds). These are calculated modeled
results under the declared higher-capacity input, not guarantees for other
layouts or forecasts. An earlier 8× exploration produced absent optional
missed-sale summaries; the chosen 4× scenario retains supplied evidence and
shows genuine improvements in this demo. No zero fallback was introduced.
