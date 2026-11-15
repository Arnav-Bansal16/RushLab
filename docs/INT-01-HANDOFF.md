# INT-01 canonical scenario-comparison handoff

## Public boundary

`compareScenarios(baseline, alternative)` remains the only public comparison
boundary. `assessScenarioCompatibility` exposes the same guard for ANA-02 to
reject candidate pairs before scoring. Both are exported from
`src/analytics/comparison` and read final `SimulationResult` metrics only;
frames and browser time are never canonical inputs.

Every new `SimulationResult` contains:

- the exact immutable `festival` input snapshot; and
- explicit `modelSemantics` for bounded itineraries, timeout/full-queue
  reselection, queue-frustration markers, and modeled missed-sale
  opportunities.

Legacy results missing either snapshot are rejected cleanly. The result schema
version alone is not evidence that queue behavior is compatible.

## Compatibility policy

Hard errors produce no metric groups. They cover unsupported schemas or model
semantics; seed, attendee count, duration, fixed step, walking speed, and every
resolved behavior setting; complete profiles including IDs, entrance/spawn,
intent, choice-stream key, preferences, tolerances, tendencies and initial
budget; invalid profile entrances; and common-entity non-layout assumptions:
entrance spawn weight, stage/amenity attraction and dwell overrides, amenity
type, and vendor category, popularity, price, service time and inventory.

Vendor position/size, servers and queue limit are layout/capacity alternatives.
Frame interval is presentation-only. One-sided metric entities and missing
legacy `missedSales` values produce visible warnings rather than fabricated
zeros.

## Metric representation

Totals, vendors, destinations and destination transitions use stable ordering
and typed numeric comparisons. Each retains raw baseline and alternative values,
the unrounded absolute delta (`alternative - baseline`), and percentage delta.
Zero baseline denominators are `not_applicable: zero_baseline`. A vendor with no
stockout is `not_applicable: no_stockout`; a missing optional metric or entity is
`unavailable`. Legitimate zero values remain available.

ANA-03 transition arrays are sparse. When a transition pair appears on only one
side, INT-01 preserves `presence` and a warning but uses a canonical raw count
of zero for the absent row. This is distinct from a missing physical entity or
legacy optional metric, which remains unavailable.

The modeled outcomes include purchases, modeled revenue, abandonments, exited
attendees; all ANA-01 vendor values including optional modeled missed-sale
count/value; all ANA-03 destination values; and destination-transition counts.
No improvement direction or candidate score is assigned by INT-01.

## Downstream use

- ANA-02 calls the guard for each paired seed, rejects `incompatible`, retains
  each `ScenarioComparison`, and scores separately from raw deltas.
- UI-03A renders compatibility plus final totals/vendor/destination groups and
  formats the already-calculated absolute/percentage values.
- UI-03B renders warnings, unavailable states, and candidate before/after
  evidence without recalculating metrics, percentages or scores.

See the focused [ANA-02 and UI-03B handoff](./INT-01-ANA-02-UI-03B-HANDOFF.md)
for sequencing, rejection rules, metric-state handling and acceptance checks.

These are deterministic modeled estimates and opportunities, not forecasts or
actual lost festival revenue.
