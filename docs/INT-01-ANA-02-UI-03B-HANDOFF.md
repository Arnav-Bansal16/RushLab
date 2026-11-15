# INT-01 handoff to ANA-02 and UI-03B

## Readiness and source of truth

Consume INT-01 only after `codex/int-01-scenario-comparison` is reviewed and
merged. The callable boundary remains:

```ts
compareScenarios(
  baseline: SimulationResult,
  alternative: SimulationResult,
): ScenarioComparison
```

ANA-02 may call `assessScenarioCompatibility` before comparison, but it must
still retain the `compatibility` returned by `compareScenarios`. Both functions
are exported from `src/analytics/comparison`.

```text
paired baseline/candidate runs
  → assessScenarioCompatibility
  → compareScenarios
  → ANA-02 rejects or scores outside INT-01
  → UI-03B renders analytics-owned evidence and states
```

INT-01 reads final result metrics only. Frames, the playback cursor and browser
time never influence compatibility or deltas.

## Current ANA-02 integration status

INT-01 is merged as PR #15 (`e38aee4`) and ANA-02 now composes its actual
`compareScenarios` export for every evaluated seed pair. The
[ANA-02 handoff](./ANA-02-HANDOFF.md) documents the final public entry points,
objective, candidate constraints, explicit failure states and review fixes.
Five dedicated ANA-02/INT-01 regression tests verify editable JSON snapshots,
canonical compatibility/warnings, optional values, zero denominators and
ranking rejection. No comparison API or canonical delta semantics were changed.
UI-03B consumes `optimizeLayout(completedResult)` and renders retained
`pair.comparison`; it does not calculate canonical deltas or scores.

## Contract facts consumers must preserve

Every current `SimulationResult` snapshots the exact run `festival`, fully
resolved `settings`, complete `attendeeProfiles`, and explicit
`modelSemantics`. A result missing the festival or semantics snapshot is a hard
incompatibility, even when `schemaVersion` is `1`.

The result groups are:

| Group                    | Stable identity       | Metric keys                                                                                                                                                                            |
| ------------------------ | --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `totals`                 | one run               | `purchases`, `revenue`, `abandonments`, `exitedAttendees`                                                                                                                              |
| `vendors`                | `vendorId`            | `visits`, `queueJoins`, `purchases`, `abandonments`, `revenue`, `averageWaitSeconds`, `maximumQueueLength`, `utilization`, `stockoutTimeSeconds`, `missedSaleCount`, `missedSaleValue` |
| `destinations`           | `destinationId`       | `visits`, `uniqueVisitors`, `repeatVisits`, `completedDwellSeconds`, `truncatedDwellSeconds`                                                                                           |
| `destinationTransitions` | `fromType` + `toType` | `count`                                                                                                                                                                                |

Each metric retains typed baseline and alternative values, absolute
`alternative - baseline`, and percentage delta. INT-01 does not assign an
improvement direction or score.

Value states are semantic, not display strings:

- `available`: use the numeric `value` without recomputing it;
- `not_applicable: zero_baseline`: percentage change has no valid denominator;
- `not_applicable: no_stockout`: the modeled run had no stockout time;
- `unavailable: metric_not_recorded`: a legacy optional result did not record it;
- `unavailable: entity_absent`: the physical entity exists on only one side;
- `unavailable: source_value_unavailable` or `non_finite_result`: no safe delta
  can be shown.

ANA-03 transition rows are sparse. An absent transition row means a raw count
of zero, not an unavailable metric. INT-01 still reports one-sided `presence`
and a warning so the change remains explicit.

## ANA-02 implementation sequence

ANA-02 owns `src/analytics/recommendations/**`. Begin with the required joint
review for shared issue/candidate/evaluation result shapes; do not create a
parallel UI-only contract.

1. Derive issues only from canonical ANA-01, ANA-03 and EXT-01 final metrics.
   Every issue needs a stable ID/order, threshold, evidence, affected entity,
   suggested action and model limitation.
2. Generate at most four candidate `Festival` snapshots in deterministic order.
   Preserve every field not named by the action.
3. P0 mutations may move vendors and change supported capacity through
   `servers` or `queueLimit`. Preserve prices, service times, popularity,
   inventory, category, stages, entrances, amenities, paths and demand
   assumptions.
4. Keep candidate geometry within bounds, outside obstacles and free of illegal
   overlap. Return complete editable festival data, not patches alone.
5. Derive a documented deterministic three-seed suite from the requested seed.
   For each seed, run one baseline and each candidate with the same settings.
   Preserving entrances and non-layout assumptions makes profile generation
   paired; verify exact `attendeeProfiles` equality rather than assuming it.
6. Run every pair through INT-01. When compatibility is `incompatible`, retain
   its structured errors, mark that candidate/seed rejected and do not score
   any null metric group.
7. Retain every per-seed `ScenarioComparison`. Aggregate and rank in ANA-02,
   outside INT-01, with a visible objective that balances the documented
   queue, wait, abandonment, utilization, stockout, throughput, destination,
   transition, frustration and modeled missed-sale evidence.
8. Do not coerce unavailable metrics or percentages to zero. Define a visible
   scoring omission/penalty policy for unavailable evidence during the shared
   contract review. A zero raw value is still legitimate evidence.
9. Return the `best-tested candidate` or `optimized candidate`; never claim a
   global optimum, forecast, statistical confidence interval or actual lost
   revenue.

`runSimulation` does not accept injected profiles. Pairing is obtained through
identical seeds, resolved settings and preserved profile-generating festival
inputs. The INT-01 guard is the final authority: a future candidate mutation
that changes profiles, entrances or demand assumptions must be rejected until
separately reviewed.

## ANA-02 minimum tests

- stable issue and candidate IDs/order across repeated calls;
- at most four legal, immutable candidates;
- exact preservation of every non-targeted festival field;
- three deterministic paired seeds with exact profile equality;
- incompatible pairs retained as rejected and never scored;
- per-seed comparisons retained without frame data or wall-clock values;
- unavailable and not-applicable metrics handled without coercion;
- one-sided sparse transition counts treated as zero by INT-01;
- ranking retains every raw metric used by its objective;
- a fixture where the best-tested candidate improves the documented aggregate
  objective without requiring every individual metric to improve;
- no `Math.random()`, hidden network call or mutation of baseline data.

## UI-03B rendering boundary

UI-03B owns presentation under `src/features/dashboard/**`. It renders ANA-02
issues, candidate changes and retained `ScenarioComparison` evidence. It must
not import metric reducers, inspect frames for final values, calculate deltas or
percentages, reinterpret compatibility, or reproduce the candidate score.

Render in this order:

1. candidate identity, tested seed set and `best-tested`/rejected status;
2. compatibility errors first, then visible warnings and model limitations;
3. the exact proposed festival changes;
4. analytics-owned score/objective evidence from ANA-02;
5. before/after raw values and INT-01 absolute/percentage deltas;
6. per-seed evidence or an explicit way to inspect it.

When compatibility is `incompatible`, all metric groups are `null`. Show the
structured errors and no fair-comparison evidence or score. Do not render an
empty array, zero or placeholder improvement as though a comparison succeeded.

For compatible results:

- format `available.value` for display only;
- show “Not applicable” for either not-applicable reason and make the reason
  accessible;
- show “Unavailable” for unavailable values, never `0`, `NaN` or infinity;
- expose `baseline_only` / `alternative_only` entity presence;
- label `revenue` as modeled revenue and missed-sale values as modeled
  opportunities, not actual losses;
- keep negative deltas visible and let ANA-02 evidence explain whether a change
  helps its objective;
- use final `SimulationResult` values from the completed ActiveRun, never the
  selected playback frame’s cumulative table.

UI formatting may add units, currency symbols, signs, precision and accessible
labels. Those are presentation decisions; the underlying numbers and states
must remain unchanged.

## UI-03B minimum tests

- incompatible comparison renders errors and no score/delta evidence;
- compatible comparison renders warnings without hiding metrics;
- positive, negative and zero deltas use the supplied values;
- zero-baseline percentage displays Not applicable;
- legacy missed-sale value displays Unavailable;
- no-stockout time displays Not applicable;
- one-sided vendors/destinations expose presence and unavailable raw side;
- one-sided sparse transitions display zero for the absent row plus its warning;
- selected playback frame changes do not change final candidate evidence;
- modeled-estimate and best-tested language is preserved;
- no percentage, aggregate metric or candidate-score math exists in UI code.

## INT-01 evidence available to downstream owners

INT-01 tests cover settings/profile/model mismatches, non-layout assumptions,
legacy results, optional missed-sale values, one-sided entities, sparse
transitions, zero denominators, raw values, ordering, immutability, JSON
round-trip, byte-equivalent repeat output, frame independence, and a real
moved/capacity-edited baseline/candidate engine pair.

The repository’s default 27-worker Vitest run can exceed the pre-existing
five-second limits on several large simulation tests under local contention.
The full 240-test suite passes with four workers, and the production build,
lint, typecheck and focused INT-01 integration suites pass. Do not weaken
correctness assertions to mask that runner-level concurrency sensitivity.
