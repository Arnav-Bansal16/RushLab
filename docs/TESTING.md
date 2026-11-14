# Testing strategy

Vitest is the P0 test runner. Keep most tests pure and fast under Node; browser automation is a release smoke check, not the primary correctness layer.

## Required behavior coverage

- Vendor choice always references a valid, available vendor.
- Vendors above an attendee's remaining budget are never selected, and higher
  prices reduce utility according to the documented deterministic formula.
- Stage-first, vendor-first, explorer, and amenity-first intents use valid
  destinations, respect overall and per-type stop limits, and safely skip and
  renormalize around missing types.
- Roaming waypoints and all destination positions remain in bounds; stage and
  amenity dwell intervals terminate deterministically.
- Type-level dwell defaults and per-location overrides resolve once, stay within
  their configured ranges, and truncate cleanly at run end.
- Effective vendor patience equals stable attendee queue tolerance multiplied
  by the configured global multiplier; dwell is never counted as queue wait.
- Each vendor visit has at most one purchase. Attendees may purchase from
  multiple distinct vendors within the vendor/overall limits, cannot select a
  vendor above remaining budget, and have each purchase deducted exactly once.
- Default itineraries have at most four stops; configured itineraries remain in
  the one-through-six range. No immediate duplicate destination is selected.
  Physical destinations are not revisited unless the bounded revisit setting
  explicitly permits it.
- Multiple distinct stages remain eligible, amenities may occur between major
  destinations, and typed early exits terminate without endless roaming.
- FIFO queues, server capacity, and simultaneous event ordering are correct.
- Purchases update inventory and event-derived results exactly once.
- Stocked-out vendors cannot complete purchases.
- Higher service capacity increases or preserves throughput under identical demand.
- Location changes affect travel/demand only through documented rules.
- Identical inputs/seeds create identical profiles, intent assignments,
  itineraries, events, frames, and metrics.
- Every generated profile stores finite non-negative bounded individual
  preferences and tendencies. Comparison layouts reuse exact profiles, budgets,
  spawn times, intents, and applicable random-choice streams.
- Baseline/alternative comparison checks compatible assumptions and shared
  profiles/intents, including every advanced behavior setting.
- Suggested positions stay in bounds and outside obstacles; capacity suggestions reference evidence.
- UI fixtures satisfy the same types returned by the engine.

## Test layers

1. Unit: PRNG stream isolation, intent assignment, destination/price utility,
   bounded itinerary planning, dwell-default resolution, queue-tolerance
   scaling, queue state, movement/dwell, and metric reducers.
2. Invariant/property-style loops: overall/per-type/revisit limits, no immediate
   duplicates, in-bounds roaming, affordable choices, multi-purchase budget and
   inventory conservation, non-negative inventory/queues, early exits, missing
   types, and stable ordering across many seeds.
3. Contract: JSON round-trip and UI/engine fixture compatibility.
4. Integration: a small festival completes spawn → stage/vendor/amenity →
   another distinct destination → purchase or exit → event-derived metrics.
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
