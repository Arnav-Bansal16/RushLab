# ANA-02 — deterministic issues and best-tested layouts

## Delivery and ownership

Implemented against merged INT-01 (`e38aee4`, PR #15). The user confirmed both
Developer A and Developer B authorize shared contract changes for ANA-02,
INT-01 and downstream integration. This records contract authorization, not
an independent human UX acceptance or release approval.

Changed files:

- `src/domain/recommendations.ts`: additive serializable report, action,
  candidate, scoring, evaluation, ranking and composition contracts.
- `src/domain/index.ts`: exports those contracts.
- `src/domain/simulation.ts`: additive legacy recommendation evidence keys;
  existing callable signatures and INT-01 comparison semantics are preserved.
- `src/analytics/recommendations/**`: snapshot equality, issues, geometry, generation, objective,
  paired evaluation, legacy adapter, composition and adjacent tests.
- This handoff and `docs/ANA-02-CONTRACT-PROPOSAL.md`.

Existing UI-03A/dashboard changes remain outside ANA-02. No UI, implicit rerun,
editor loading, engine formula change, dependency or release behavior was added.

## Canonical entry points for UI-03B

Import from `src/analytics/recommendations`:

```ts
const output = optimizeLayout(completedActiveRun.result);
// output.issues, output.generation, output.seeds, output.ranking
const selected = output.generation.candidates.find(
  candidate => candidate.id === output.ranking.bestTestedId,
);
// selected?.festival is an independent editable Festival snapshot.
```

Call only on an explicit user action. `buildIssuesReport(result)`,
`generateCandidates(result.festival, report)` and
`evaluateCandidates(festival, settings, candidates)` also work separately.
`recommendPlacements(festival, result)` retains the existing callable boundary,
requires the matching run snapshot, and adapts only legal generated candidates.
Its legacy evidence is intentionally smaller than the issue report; use the
rich output for UI-03B, including explicit server before/after values.

The report retains an independent festival snapshot; generation rejects stale
or mismatched editor inputs. No-candidate outcomes include explicit reasons,
including findings with no supported executable action.

Every seed retains completed baseline/alternative results and the unmodified
INT-01 comparison. Render absolute and percentage deltas directly. A failed
pair retains its stage, reasons, completed results, canonical compatibility
errors and comparison when available. Its score is null. Missing evidence is
not numeric zero. All output works without frames and survives JSON round-trip.

## Issue policy v1

All boundaries are inclusive, finite canonical evidence is required, and IDs
encode category, sorted affected entity IDs and metric (never metric values).
Order is high/medium/low severity, category, then stable ID using code-unit
comparison. No frame, selected playback time or live editor state is read.

| Finding / evidence | Trigger | Minimum activity | Severity |
| --- | --- | --- | --- |
| Average vendor wait | >=60 seconds | 10 vendor queue joins | medium; high >=120 |
| Peak vendor queue | >=10 | 10 vendor queue joins | medium; high >=20 |
| Abandonments / joins | >=0.20 | 10 vendor queue joins | medium; high >=0.40 |
| Vendor utilization / modeled overload | >=0.90 | 10 vendor queue joins | medium; high >=0.98 |
| Vendor underuse (utilization) | <=0.10 | 20 festival queue joins | low |
| Stockout timestamp | finite timestamp <=run duration, finite inventory | 1 vendor purchase | low |
| Modeled missed-sale attempts | >=5 | 5 attempts | medium; high >=10 |
| Modeled frustration attempts | >=5 canonical `missed_sale` events for vendor | 5 attempts; current EXT-01 semantics | medium; high >=10 |
| Same-type destination visit share | >=0.75 | two same-type destinations and 20 type visits | medium; high >=0.90 |
| Same-type destination underuse | <=0.05 visit share | two same-type destinations and 20 type visits | low |
| Same-type destination dwell share | >=0.75 | same visit minimum and positive total type dwell | medium; high >=0.90 |
| Weak type transition | <=0.05 of outgoing transitions | 20 outgoing transitions; distinct existing target type with positive configured type weight | low |

Dwell is completed plus truncated destination dwell, never queue wait. Sparse
ANA-03 transitions represent zero counts. Weak transitions and uneven visits
are descriptive modeled patterns; configured preferences, affordability,
attraction and stop limits may explain them. They do not prove a physical
capacity problem. Underuse/imbalance/stockout/transition findings suggest review
and monitoring, without inventing an unsupported capacity remedy. Supported
wait, queue, abandonment, high utilization, frustration and missed-sale load
findings generate explicit testable placement/capacity actions.

A null stockout timestamp means no stockout; timestamp zero is valid. Unlimited
inventory does not generate a stockout finding. No activity means no positive
load or imbalance finding; low vendor utilization requires activity elsewhere.
Missing vendor summaries, missing optional missed-sales summaries, unsupported
EXT-01 evidence and non-finite metric values have explicit unavailable reasons.
A missing optional summary does not silently become a zero-valued finding.
Every finding carries numeric evidence, unit, rule, threshold, activity count,
rationale, suggested action and an applicable limitation.

## Candidate constraints and bounds

Enumerate findings in report order, then their explicit action order: one extra
server, then offsets (+10,0), (0,+10), (-10,0), (0,-10) meters from the original
vendor position. At most 32 attempted layouts and four accepted candidates.
Each candidate applies exactly one named action. Supported server counts are
integers 1–100; candidates preserve service times, inventory, queue limits,
prices, popularity, categories, stages, entrances, paths, amenities, obstacles
and all unrelated fields. Capacity cost is not modeled by the objective.

Deduplicate sorted vendor ID/x/y/server configurations, ignoring finding/action
IDs. Stable candidate IDs encode the actual change. Every snapshot and its
change values are independent clones. External editable candidates are checked
against their declared before/after changes before simulation; undeclared
changes cannot be ranked. Invalid actions return named reasons, including
unknown vendor, invalid capacity, bounds, overlap, duplicate, unchanged,
unsupported action and search/candidate limits.

The existing editor `clampVendorPosition` and `validateSimulationFestival` were
audited: they enforce bounds/input validity but do not check polygon obstacle
or rectangle overlaps. They cannot establish legal candidates. ANA-02 therefore
exports a pure reusable `validateCandidateGeometry`, matching the existing
world-meter, top-left/full-size bounds convention and extending it with
rectangle-vs-polygon containment/intersection and vendor-vs-vendor/stage/amenity
checks. Entrance points may not be covered. Rectangles may share an edge;
obstacle contact is rejected conservatively. Paths are routing infrastructure,
not solid footprints. Malformed obstacle polygons or non-finite bounds cannot
establish legality. The validator checks all vendors, so a pre-existing illegal
vendor elsewhere may prevent a one-action repair; no legal candidate is then
reported explicitly. This is geometry validation, not crowd-flow science.

## Paired evaluation and objective v1

For requested safe-integer seed, normalize `s = seed | 0` and test
`[s, (s + 1) | 0, (s + 2) | 0]`, including signed wrapping. Run one baseline per
seed and reuse it across candidates: at most 15 simulations total. Settings are
identical inside each pair. INT-01 verifies exact profile IDs, budgets, spawn
times, choice-stream inputs, intents, seed, duration, demand, behavior and
explicit model semantics; incompatibility rejects rather than scores the pair.
No injection API or engine signature change is needed.

The baseline objective is zero; scores measure normalized paired improvements.
Higher scores are better. Each component contributes
`weight * direction * (alternative - baseline) / normalization`.

| Component | Better direction | Weight | Fixed normalization |
| --- | --- | --- | --- |
| Mean vendor queue wait | lower | 0.20 | 60 seconds |
| Abandonment attempts / attendee | lower | 0.15 | 1 |
| Stocked-out vendor share | lower | 0.10 | 1 |
| Purchases / attendee | higher | 0.10 | 1 |
| Modeled revenue / attendee | higher | 0.10 | baseline mean vendor price, minimum 1 currency unit |
| Destination visit coverage | higher | 0.10 | 1 |
| Modeled frustration attempts / attendee | lower | 0.10 | 1 |
| Modeled missed-sale value / attendee | lower | 0.15 | same price normalization |

Queue wait weights canonical vendor means by their canonical service-start
counts (the ANA-01 wait denominator), not visits, purchases or queue joins.
No service starts means unavailable mean wait. Coverage is the fraction of
physical destinations with a visit, not total dwell or attendee density.
Frustration is canonical missed-sale event count, not currently visible markers.
For current EXT-01 runs, a vendor with no optional missed-sales summary and no
missed-sale events has event-supported zero opportunities; a missing summary
with actual attempts is unavailable. Legacy/unsupported semantics do not enable
that zero inference. INT-01's optional-metric unavailable values remain intact
in the raw comparison regardless of this objective's documented event fallback.

Enable only components available in all three baseline seeds, renormalizing
weights once for the whole batch. The candidate set never determines scales or
weights. An expected component missing in an alternative makes that pair fail;
required canonical vendor/destination summaries must be complete and finite. Destination identity and type must match the
festival exactly, without duplicates; incomplete or invalid destination evidence
also suppresses relational findings instead of inventing imbalance.
Zero attendees makes all per-attendee components unavailable; legitimate zero
stockout/coverage values remain available. No enabled evidence means no score.
Each component exposes raw values, effective weight, normalization and reason
for omission. Raw per-vendor/total/destination deltas remain in INT-01, including
`not_applicable: zero_baseline` percentages; the objective never substitutes a
fabricated percentage.

Average three successful seed scores equally. Any failed pair makes the
candidate ineligible. Rank descending by aggregate, then stable candidate ID;
record exact-equality tie groups. The highest-ranked candidate is best-tested,
even if its score is zero or negative. `improvingId` exists only for a strictly
positive score. Separate outcomes cover no candidates, no successful evaluation,
no improvement and improvement. Improvements need not include every metric.
These assumptions are transparent demo choices, not calibrated standards.

## Observed example and verification

The adjacent real integration fixture uses demo geometry, no stage, one vendor
with one server and 40-second service; 50 attendees, 240 seconds, 0.5-second
steps, seed 71, and explicit vendor-first intent weights. Its best-tested layout
adds a second server; aggregate objective improvement is 0.08388720538720544.

| Seed | Purchases before → after | Modeled revenue before → after | Mean wait seconds before → after | Abandonments before → after | Peak queue before → after |
| --- | --- | --- | --- | --- | --- |
| 71 | 5 → 9 | 60 → 108 | 68.25 → 42.3182 | 5 → 3 | 23 → 23 |
| 72 | 4 → 8 | 48 → 96 | 59.2 → 50 | 3 → 3 | 21 → 17 |
| 73 | 5 → 10 | 60 → 120 | 66.4167 → 51.25 | 5 → 3 | 23 → 21 |

The four candidates score approximately +0.0838872 (server +1), +0.0190741
(x+10), -0.0107222 (y+10), -0.00653704 (x-10). Optional missed-sale attempt/value
pairs for the selected layout are 5/60 → 3/36, 3/36 → 3/36, 5/60 → 3/36.
Separate scoring evidence proves an objective improvement while revenue worsens.

Original isolated evaluation time: 56–57 ms for four candidates × three seeds plus
three reused baselines, on this local Darwin arm64 host with Node v26.10.0; repeated output was byte-identical.
This is a small-fixture timing, not PERF-01 acceptance or a latency guarantee.
The complete evaluation test runs with final results stripped of all frames.

Verification completed:

- Targeted recommendation suites: 25 passing cases, including frame-free real
  simulation, byte-identical repeated evaluation, stale snapshot rejection,
  incomplete evidence, profile/model incompatibility and serialization.
- `npm run typecheck`: passed independently and within full verification.
- `npm run verify`: passed lint, typecheck, 273 tests across 31 files and
  production build. This includes ANA-01/ANA-03/EXT-01/INT-01 plus simulation
  determinism, event/metric agreement, queue conservation, inventory and
  compatibility coverage. Final verification timing is recorded in the review section below.
- `git diff --check`: passed. Source scan found no `Math.random()`, UI/browser
  dependency, timers or network calls in recommendations or simulation.

Read-through integration review found no remaining material contract or
ownership conflict. This is agent verification, not a claim of final human UX
acceptance. Existing UI-03A working changes were preserved.

## Limitations and remaining task boundary

All values are modeled estimates, never forecasts. Frustration is a modeled
state; missed sales are opportunity attempts, not unique people or actual lost
festival revenue. The three-seed average is not a confidence interval. The
selected layout is best-tested, not globally optimal. There are no validated
crowd-flow, physical congestion or safety findings.

UI-03B presentation/loading, production-scale PERF-01 and release acceptance
remain their assigned work. Human UX review can use the contracts, entry points
and explicit states above; no dashboard implementation is included here.


## Integration review follow-up

ANA-02 was reviewed against the actual merged INT-01 implementation in
`src/analytics/comparison`, not only its type declaration. The review corrected:

- Snapshot guards previously compared JSON strings, falsely rejecting equivalent
  festival/position objects with reordered property keys. Guards now compare
  object properties structurally while preserving array order and all field
  values. Changed demand or non-layout fields remain rejected.
- Destination shares and transition findings could use incomplete destination
  arrays. They now require every expected destination ID/type exactly once with
  finite nonnegative evidence; missing, duplicate, mis-typed or invalid rows
  produce an unavailable reason. The same guard protects coverage scoring.
- Ranking now checks each successful seed's INT-01 compatibility and non-null
  comparison groups in addition to eligibility and finite scores, so restored
  inconsistent evaluation data cannot become a selected candidate.
- Frustration findings require the supported frustration policy as well as
  the supported missed-sale policy; an unknown frustration policy cannot supply
  a seemingly supported finding.

`src/analytics/recommendations/int01.integration.test.ts` adds five focused
regressions. Together with existing recommendation and INT-01 suites, 43 tests
pass. The tests exercise reordered editable JSON, incomplete/duplicate/invalid
destination summaries, unknown frustration semantics, and ranking rejection of
incompatible or incomplete comparisons. They explicitly assert unchanged raw
`compareScenarios` output, compatibility warnings, optional-metric unavailable
states, no-stockout states and zero-baseline percentage representations.

INT-01 integration requires no new comparison API, engine change or UI math:

```ts
import { optimizeLayout } from "@/analytics/recommendations";
import { compareScenarios } from "@/analytics/comparison";

const report = optimizeLayout(completedResult);
for (const evaluation of report.ranking.evaluations) {
  for (const pair of evaluation.seeds) {
    if (pair.status === "failed") {
      // Render pair.stage, pair.reasons and pair.comparison?.compatibility.
      continue;
    }
    // pair.comparison is the retained canonical comparison, equivalent to:
    const canonical = compareScenarios(pair.baseline, pair.alternative);
    // Render canonical values/states; use ANA-02's supplied score for ranking.
  }
}
```

The example recomparison demonstrates the integration contract; UI-03B should
normally render `pair.comparison` directly without repeating work. No source
under `src/analytics/comparison` was changed by this follow-up.


Final follow-up verification: `npm run verify` passed lint, typecheck, all 273
tests across 31 files (1.72-second test execution), and production build.
`git diff --check` passed. No remaining material issue was found in the reviewed
ANA-02/INT-01 integration; this records the checked paths and does not claim
that testing proves the absence of every possible defect.

PR isolation check: exported the staged ANA-02 files over merged INT-01 HEAD
into a clean temporary checkout, excluding all uncommitted UI-03A/dashboard
files. `npm run verify` passed lint, typecheck, 265 tests across 29 files
(1.63-second test execution) and production build. The 273-test count above
includes eight tests from the separate UI-03A working changes; the isolated
265-test count is the reproducible validation for this PR's file set.
