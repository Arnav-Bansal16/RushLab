# Testing strategy

Vitest is the P0 test runner. Keep most tests pure and fast under Node; browser automation is a release smoke check, not the primary correctness layer.

## Required behavior coverage

- Vendor choice always references a valid, available vendor.
- Vendors above an attendee's remaining budget are never selected, and higher
  prices reduce utility according to the documented deterministic formula.
- Stage-first, vendor-first, explorer, and amenity-first intents use valid
  destinations, respect the maximum-stop limit, and safely skip missing types.
- Roaming waypoints and all destination positions remain in bounds; stage and
  amenity dwell intervals terminate deterministically.
- FIFO queues, server capacity, and simultaneous event ordering are correct.
- Purchases update inventory and event-derived results exactly once.
- Stocked-out vendors cannot complete purchases.
- Higher service capacity increases or preserves throughput under identical demand.
- Location changes affect travel/demand only through documented rules.
- Identical inputs/seeds create identical profiles, intent assignments,
  itineraries, events, frames, and metrics.
- Baseline/alternative comparison checks compatible assumptions and shared
  profiles/intents, including every advanced behavior setting.
- Suggested positions stay in bounds and outside obstacles; capacity suggestions reference evidence.
- UI fixtures satisfy the same types returned by the engine.

## Test layers

1. Unit: PRNG stream isolation, intent assignment, destination/price utility,
   bounded itinerary planning, queue state, movement/dwell, and metric reducers.
2. Invariant/property-style loops: maximum stops, in-bounds roaming, affordable
   choices, conservation, non-negative inventory/queues, and stable ordering
   across many seeds.
3. Contract: JSON round-trip and UI/engine fixture compatibility.
4. Integration: a small festival completes spawn → stage/roam/amenity → queue →
   purchase or exit → event-derived metrics.
5. Performance: 250/300 attendee run and 300-circle playback budget; report machine and numbers.
6. Release smoke: edit vendor position/price and behavior settings, run
   baseline, run a compatible alternative, then view playback,
   deltas/recommendation, and modeled-assumption warnings on preview.

Avoid snapshotting wall-clock runtime, canvas pixels, or entire large frame payloads. Snapshot deterministic event/metric subsets when they improve reviewability.

## Templates

```ts
it("is reproducible", () => {
  const first = runSimulation(festival, settings);
  const second = runSimulation(festival, settings);
  expect(second.events).toEqual(first.events);
  expect(second.vendorMetrics).toEqual(first.vendorMetrics);
});

it("reconciles purchases", () => {
  const result = runSimulation(festival, settings);
  const purchaseEvents = result.events.filter(
    (event) => event.type === "purchase",
  );
  expect(result.totals.purchases).toBe(purchaseEvents.length);
});
```

## Merge gate

Run targeted tests during development, then:

```bash
npm run verify
```

A PR cannot merge with failing lint, typecheck, tests, build, undocumented contract changes, or an unexplained performance regression.
