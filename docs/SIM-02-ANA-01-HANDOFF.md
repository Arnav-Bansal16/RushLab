# SIM-02 to ANA-01 handoff

## Status and base

ANA-01 depends directly on the implemented SIM-02 event ledger. Start from
`codex/sim-02-queue-service` at commit `c2432c1`, which contains:

- SIM-02 implementation commit `711e2c2`;
- the verified SIM-02 → UI-02 handoff; and
- the unchanged v1 `RunSimulation` and `SimulationResult` contracts.

The cleanest sequence is to merge SIM-02, update `main`, and create the ANA-01
branch from that updated `main`. If ANA-01 must begin before SIM-02 merges,
create it as a stacked branch from `codex/sim-02-queue-service`, do not merge it
first, and rebase it after SIM-02 lands.

## Mission and ownership

ANA-01 owns the final canonical reduction of SIM-02 events into
`VendorMetrics[]` and `SimulationResult.totals`.

Primary ownership:

- `src/analytics/metrics/**`;
- adjacent analytics tests; and
- one narrow composition change needed to make `runSimulation` call the
  analytics reducer.

Do not independently change:

- `src/domain/**` or `src/fixtures/**`;
- queue, service, inventory, movement, profile, arrival, or RNG behavior;
- frame construction or playback semantics;
- UI dashboard or comparison behavior; or
- package dependencies.

If a new metric field or event type is required, stop and open a separate
contract PR. Do not create a private parallel event or result interface.

## Existing temporary reducer

SIM-02 currently uses `src/simulation/events/reduce.ts` to return coherent,
contract-valid placeholder aggregates. ANA-01 must replace this with one
analytics-owned reducer rather than leaving two metric implementations.

A suitable boundary is:

```ts
type DeriveSimulationMetrics = (
  events: SimulationEvent[],
  vendors: Vendor[],
  settings: SimulationSettings,
) => Pick<SimulationResult, "vendorMetrics" | "totals">;
```

The reducer must be pure and deterministic. It must not mutate events, vendors,
settings, profiles, frames, or the input festival. It must not read frames as a
metric source.

After the reducer is implemented and tested under `src/analytics/metrics/**`,
make the smallest composition change in `src/simulation/runSimulation.ts` so
the existing `runSimulation(festival, settings)` export calls it. Retire the
temporary simulation reducer or turn it into a non-calculating compatibility
re-export; do not preserve duplicate formulas.

The dependency direction should remain one-way:

```text
runSimulation composition → analytics metrics reducer → domain types
```

Analytics must not import React, Konva, Recharts, browser timers, database
clients, or simulation runtime state.

## Canonical ledger rules

Consume `SimulationResult.events` in its existing array order. Do not re-sort
events: SIM-02 already supplies deterministic causal ordering for equal
timestamps, followed by stable vendor and attendee IDs.

Maintain reducer-local maps for:

- attendee/vendor queue join time;
- current waiting membership;
- active service start time and vendor;
- per-vendor current and maximum waiting queue length; and
- per-vendor accumulated busy seconds.

Treat impossible sequences as invariant failures in tests rather than silently
allowing negative queue lengths, duplicate memberships, duplicate service
starts, or unmatched purchases.

### Metric definitions

| Result field             | Canonical derivation                                                                                                                                        |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `visits`                 | Count admitted `queue_join` events. Full-queue rejection is not visible in the frozen event union and cannot count as a visit.                              |
| `queueJoins`             | Count `queue_join` events for the vendor.                                                                                                                   |
| `purchases`              | Count `purchase` events for the vendor.                                                                                                                     |
| `revenue`                | Sum `purchase.amount` for the vendor. This is a modeled estimate, not a forecast.                                                                           |
| `abandonments`           | Count `queue_abandon` events. This includes timeout abandonment and waiting requests removed when stockout makes service impossible.                        |
| `averageWaitSeconds`     | Average completed wait from matching `queue_join` to `service_start`. Return `0` when there are no service starts. Do not derive this from frames.          |
| `maximumQueueLength`     | Maximum waiting membership reached while processing ordered queue transitions. Active service slots are excluded.                                           |
| `utilization`            | Sum completed or run-end-truncated service intervals divided by `vendor.servers * settings.durationSeconds`. Return `0` for zero capacity or zero duration. |
| `stockoutTimeSeconds`    | Timestamp of the first `stockout`; otherwise `null`.                                                                                                        |
| `totals.purchases`       | Count all `purchase` events.                                                                                                                                |
| `totals.revenue`         | Sum all `purchase.amount` values.                                                                                                                           |
| `totals.abandonments`    | Count all `queue_abandon` events.                                                                                                                           |
| `totals.exitedAttendees` | Count all `exit` events.                                                                                                                                    |

Return one `VendorMetrics` entry for every festival vendor, including vendors
with no demand, in stable vendor-ID order.

### Queue and service transitions

- `queue_join` adds exactly one waiting membership and records its join time.
- `service_start` removes that waiting membership, records the completed wait,
  and opens one active service interval.
- `queue_abandon` removes one waiting membership and does not open service.
- `purchase` closes the matching active service interval, increments purchases,
  and adds its amount to revenue.
- `stockout` records only the first timestamp.
- `exit` closes an active service interval only when the attendee still has one
  open, which represents SIM-02 run-end truncation. A normal exit after purchase
  must not add more busy time. It also removes an unresolved waiting membership
  when run-end cleanup used the existing exit path.

SIM-02 reserves finite inventory before service starts, so a valid ledger never
contains a purchase after the vendor's stockout. ANA-01 should assert this in
tests rather than attempting to repair an invalid ledger.

## Required tests

Use targeted event arrays and several real `runSimulation` results. Avoid full
frame snapshots and wall-clock assertions.

At minimum, prove:

- empty events and zero-demand vendors return complete zero-valued metrics;
- purchase counts and revenue reconcile exactly with `purchase` events;
- vendor totals sum exactly to result totals;
- completed wait uses `queue_join` → `service_start` and handles zero waits;
- abandonment counts and `waitedSeconds` agree with matching queue events;
- maximum queue follows ordered transitions and excludes active servers;
- utilization handles overlapping servers, completed purchases, run-end exits,
  zero duration, and zero servers without exceeding valid bounds;
- stockout time uses the first event and remains `null` when absent;
- run-end exit cleanup leaves no open queue or service membership;
- duplicate or impossible transitions are detected by invariant tests;
- vendors with no demand still appear in stable ID order;
- same input and seed produce identical metrics;
- changing frames without changing events cannot change metrics;
- inputs and events remain unchanged after reduction; and
- the returned metrics and totals remain JSON-serializable.

Run the SIM-02 conservation and frame-reconciliation tests alongside the new
analytics tests. Before merge, run:

```bash
npm run verify
```

## Downstream handoff

UI-03 consumes `SimulationResult.vendorMetrics` and `SimulationResult.totals`.
It must not import the reducer or calculate canonical values from frames.

INT-01 also depends on ANA-01. Scenario comparison must reuse compatible
settings and attendee profiles or surface a warning; it must not present
incompatible runs as a fair comparison.

ANA-02 depends on ANA-01 plus INT-01 and must cite calculated metric evidence
for every recommendation.

## Known limits that are not ANA-01 bugs

- Full-queue rejection has no canonical event, so it is not represented in
  visits or abandonments.
- Attendee budget and price sensitivity are profile fields but do not yet alter
  purchase completion or the amount charged.
- Purchase amount is the vendor's modeled `averagePrice`.
- There is no explicit `service_complete` or `service_cancel` event. A purchase
  ends completed service; an exit can end a run-truncated active interval.
- Queue-abandon events do not distinguish timeout from stockout removal.
- Results are deterministic modeled estimates, not forecasts.

The expanded P0 addresses price-sensitive choice and general destinations only
after ANA-01 through CON-02, SIM-03, UI-04, and ANA-03. ANA-01 must remain a
vendor-ledger reduction and must not absorb attendee intent, destination
planning, advanced settings, or destination metrics.

Changing any of these semantics requires a separately reviewed simulation or
contract task; do not hide such changes inside ANA-01.

## Definition of done

ANA-01 is complete when the analytics-owned reducer is the only canonical
metric implementation, `runSimulation` returns its output without changing the
public signature, every vendor and total reconciles with the event ledger,
queue/wait/utilization invariants pass across explicit seeds, downstream UI can
consume the existing result contract unchanged, and `npm run verify` is green.
