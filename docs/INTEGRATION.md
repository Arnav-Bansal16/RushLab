# Integration contracts and checkpoints

## State flow

1. Editor owns a serializable `Festival` draft in meters.
2. “Run” snapshots that draft and `SimulationSettings`; later editor changes do not mutate the active result.
3. `runSimulation` initializes deterministic profiles and emits events plus sparse frames.
4. Analytics derives canonical metrics from events and returns `SimulationResult`.
5. Playback reads frames. Dashboard reads metrics. Neither mutates the result.
6. An alternative layout reuses baseline settings and attendee profiles.
7. `compareScenarios` validates compatibility before calculating deltas.
8. Recommendations use festival constraints and calculated results.
9. Optional AI receives only a compact structured comparison/recommendation payload.

## Contract rules

- All public domain objects are JSON-serializable; no class instances, functions, `Date`, `Map`, or circular references.
- IDs are stable strings and arrays use deterministic ID ordering where order affects behavior.
- Festival entity IDs are unique across the document. Attendee and vendor IDs are unique within each result collection or frame where they identify an entity.
- `Point` positions and `Size` dimensions are world-space meters. The origin is the festival bounds origin, coordinates are finite and within `boundsMeters`, and the renderer transform is presentation-only.
- Simulation timestamps are seconds from run start.
- Currency is display units for P0; if real payments/reporting are added, migrate to integer minor units.
- `schemaVersion: 1` is required on festival and result documents.

## Shared fixtures

- `demoFestival` is the reviewed baseline layout.
- `demoSimulationResult` is coherent illustrative modeled output for that layout; it is not a forecast or benchmark.
- Every shared fixture must satisfy its public TypeScript contract, use unique IDs in the scopes above, and round-trip through `JSON.stringify`/`JSON.parse` without data loss.

## Fair comparison guard

Baseline and alternative must match on seed, attendee count/profiles, duration, fixed step, walking speed, and non-layout demand assumptions. A mismatch must either reject comparison or populate `ScenarioComparison.warnings`; it must never silently present a fair-looking delta.

## Event-to-metric ownership

| Metric | Canonical events/state |
|---|---|
| purchases / revenue | `purchase` |
| abandonment and wait | `queue_join` + `queue_abandon` |
| completed wait | `queue_join` + `service_start` |
| maximum queue | ordered queue transitions |
| stockout time | first `stockout` |
| utilization | service intervals divided by server-time capacity |

Tests must reconcile aggregates with the event ledger.

## Vertical integration sequence

- CP1: UI renders the shared `Festival`; engine test accepts the same object.
- CP2: one attendee's spawn → movement → queue → purchase appears in events and a frame.
- CP3: 250 attendees produce playback and charts from one real result.
- CP4: move one vendor, rerun with common profiles, compare and recommend.
- CP5: run the exact demo script against a Vercel preview.

If a contract must change after CP1, open a small contract PR first, update fixtures/tests, get both humans to review, merge, then rebase dependent branches.
