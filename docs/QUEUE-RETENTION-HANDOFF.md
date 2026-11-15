# Queue retention, frustration and modeled missed sales

Draft implementation on `codex/queue-abandonment-retention`, based on UI-04
`656e690`. User explicitly requested continued visits after queue abandonment,
frustration colors, full-queue indication and a value per missed sale. They
selected average vendor price as the per-opportunity value. No main changes.

## Shared contract: requires both developers' review

AGENTS.md says: “src/domain/** and src/fixtures/** are jointly owned. Changes
require review from both developers.” This branch changes domain output fields
and event types and is a separate draft extension, not an approved UI-04-only
change. No joint approval is claimed. Fixtures remain unchanged.

- `QueueFrustration`: vendor ID, wait_too_long/queue_full reason, timestamp and
  missedSaleValue. Optional on attendee frames, emitted for 15 simulated seconds.
- Optional vendor-frame queueFull reflects waiting capacity, not in-service count.
- New canonical missed_sale event uses the same record plus attendee ID.
- Optional vendorMetrics.missedSales supplies count/value from analytics; old
  results/fixtures without it remain renderable. Schema-v1 inputs are unchanged.
- Old queue_tolerance_exceeded exit reason remains accepted for historical data.

## Behavior and presentation

Queue timeouts and zero-patience rejection no longer call beginExit. They record
one missed-sale opportunity and re-enter destination selection. Full finite
queues do the same. Overall/per-type/revisit limits, no immediate repeats,
remaining time/budget/eligibility and actual festival exits remain bounded.
If no legal destination remains, an attendee may still exit for that reason;
queue abandonment itself is not an unconditional festival exit.

Red indicates modeled frustration; normal movement/queue/service status and
world position remain engine supplied. Red lasts 15 simulated seconds (except
leaving/exited status takes precedence), while the per-customer event remains
in the full-run ledger. Queue-full labels appear on the map and frame table.
Featured demo now has eight waiting spaces per stall and patience multiplier 1
to exercise full/abandoned queues. Shared default settings are unchanged.

Analytics, not UI, sums event opportunity values. Missed opportunities are
separate from actual purchase revenue, costs/profit, inventory and budgets.
They count attempts, not unique people: a guest can reject multiple different
stalls and buy elsewhere. They are not guaranteed lost revenue, actual festival
losses, or forecasts. Stockout-only removal and ordinary festival departure are
not given invented purchase amounts. Every long-wait/full-queue opportunity is
listed by timestamp, customer, stall, reason and amount in playback's ledger.

## Verification

`src/simulation/queueRetention.test.ts` exercises both reasons, onward purchase
at another stand, same-seed equality, immutable inputs, JSON roundtrip, bounded
frustration markers and exact event-to-vendor missed-sale agreement; actual
purchase revenue remains independent. Existing queue/service/inventory/budget,
metric and compatibility suites are rerun. Playback rendering tests verify red
markers, the full label, supplied opportunity values and per-customer reasons.

Browser smoke: real 300-guest/600-second demo; new per-stall missed-sale columns
visible; at 360 seconds Coffee Corner, Burger Grill and Ice Cream showed full
waiting queues. Map showed red frustration markers and FULL labels. Updated
preview left open and paused. No fresh FPS assertion.

Final verification result is recorded below. Before merging, both developers
must review the contract extension and behavior/analytics semantics. Automatic
PR creation has previously returned GitHub integration 403; no PR or merge is
claimed without a successful API response.

Final verification: npm run verify passes lint, strict types, all 179 tests
in 24 files and production build. Shared fixtures and dependencies unchanged.

## Simplified presentation update

The visible legend groups entering/choosing/walking/roaming/next-stop travel
under one blue Walking category. Queued stays amber. Service and dwelling no
longer appear as separate legend categories; those stationary guests use neutral
gray while engine states remain intact for inspection. Red frustration, magenta
leaving and faded exited identity are preserved. Frustrated now counts the red
markers in the selected frame only; this is a visual playback count, not a
canonical cumulative unique-customer metric.

Stall statistics use shorter headers, shared consistent two-decimal currency
formatting, grouped counts and right-aligned tabular numbers. Actual revenue
and modeled missed-sale value remain separate full-run engine values. Browser
inspection at 360 seconds showed six frustrated guests and the cleaned table.
Verification: npm run verify passes lint, types, 180 tests and production build.
No simulation or shared-contract changes in this presentation update.

## Playback-paced business statistics

The earlier fixed full-run stall table is superseded by the user's request for
statistics to follow demo playback. Vendor frames now optionally include
cumulativeRevenue, cumulativeMissedSales and cumulativeMissedSaleValue. An
analytics-owned single-pass event ledger generates these recorded snapshots;
the final metrics reducer shares the same business accumulator. UI formats
frame values only. Legacy frames without these values display Unavailable
instead of leaking final totals or inventing zeros. Final result metrics remain
unchanged for future dashboard consumers. The missed-sale ledger also filters
out entries after the selected timestamp.

Browser verification: zero at 0:00, intermediate values at 6:00, all values
zero after Restart, fresh demo starts at zero and plays. Tests cover exact event
boundaries, immutable inputs, determinism, restart and final frame agreement
with final vendor metrics. npm run verify passes lint, types, 182 tests and build.
This additive frame contract is included in the branch's required joint review.
