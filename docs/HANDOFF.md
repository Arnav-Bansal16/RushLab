# Current implementation and expanded P0 handoff

## Current checkpoint

- UI-01, SIM-01, and SIM-02 provide the editor, deterministic profiles and
  movement, vendor queues/service/purchases, inventory, events, and frames.
- UI-02 exists separately and still needs normal review/integration into
  `main`.
- ANA-01 is implemented locally on `codex/ana-01-event-metrics` at commit
  `783fd45`; it has not been pushed or merged. It remains intentionally limited
  to canonical vendor metrics and totals from the SIM-02 event ledger.
- CON-02 now defines the additive schema-v1 behavior/destination contract,
  resolved defaults, individual attendee parameters, generic visit/exit events,
  destination result shapes, and reviewed multi-destination fixtures. SIM-03,
  ANA-03, and the advanced UI controls remain separate implementation tasks.

The present SIM-02 engine still sends an attendee to one available vendor
whenever a vendor exists. It now snapshots resolved behavior settings and
complete deterministic profiles, but does not yet use them to produce price
elasticity, bounded multi-stop choice, stage-first behavior, amenities, or
roaming. The multi-destination result fixture demonstrates the approved ledger;
it is not a claim that SIM-03 is already implemented.

## Approved expanded P0 shape

Keep the addition compact:

1. One joint contract task: CON-02.
2. One simulation task: SIM-03.
3. One frontend task: UI-04.
4. One destination-analytics task: ANA-03.

P0 supports stage-first, vendor-first, explorer, and amenity-first intents;
editable vendor price; affordable price-sensitive vendor choice; bounded
roaming; deterministic stage/amenity dwell; and a small advanced-settings
panel. Each attendee defaults to at most four destinations, configurable from
one through six, with vendor, stage, and amenity caps defaulting to two each.
Physical destinations are distinct by default; an explicit setting may enable
bounded revisits. Vendors remain the only queued/service destinations.
Nonvendor amenities do not model congestion, staffing, medical incidents, or
service queues.

The P0 parameter source of truth is `docs/ARCHITECTURE.md`: stage 30–120
seconds, restroom 45–120, seating 30–180, and first aid 60–300, with optional
per-location overrides. Attendee queue tolerance is separately multiplied by a
global 0–5 setting. Each vendor visit permits at most one purchase; an attendee
may visit and purchase from multiple affordable vendors within the configured
vendor and overall limits. Vendor price and service time remain per-vendor
inputs, and every completed purchase deducts from remaining budget exactly once.

The exact default weights, price formula, destination eligibility, and scope
limits are in `docs/ARCHITECTURE.md`. Task ownership and acceptance criteria are
in `docs/TASKS.md`.

## Required implementation order

1. Merge or otherwise finish the current SIM-02/UI-02/ANA-01 vertical slice and
   run `npm run verify`.
2. Implement CON-02 alone. Jointly review changes to `src/domain/**`,
   `src/fixtures/**`, and the shared fixtures; merge it before dependent work.
3. Rebase from the merged CON-02 contract.
4. Run SIM-03 and UI-04 in parallel because they own disjoint folders.
5. Start ANA-03 only after SIM-03 fixes the destination event ledger.
6. Integrate UI-03 and INT-01 with the new metrics and fair-comparison checks.
7. Run the full CP3B demo flow, `npm run verify`, and the 300-attendee playback
   check before feature freeze.

Do not add behavior changes to ANA-01, do not let UI calculate choices or
canonical metrics, and do not let SIM-03 independently invent a private event
or settings interface.

## Developer A handoff

After CON-02 merges, implement UI-04 under `src/features/**` and narrow app
composition:

- add `averagePrice` to vendor creation and editing;
- expose vendor service time and optional stage/amenity dwell overrides;
- expose only the approved advanced settings: intent/destination weights,
  overall/per-type/revisit limits, dwell/roam ranges, deterministic exit
  settings, queue-tolerance multiplier, and price elasticity;
- validate finite non-negative values and the all-zero eligible-weight case;
- snapshot festival and settings before each run;
- display behavior assumptions as modeled inputs; and
- render generic engine-supplied destinations/dwelling without calculating
  attendee choices, visits, revenue, or other canonical metrics.

## Developer B handoff

After CON-02 merges, implement SIM-03 under `src/simulation/**`:

- assign stable intent independently from movement draws;
- build bounded itineraries with default four stops, configurable from one
  through six, while enforcing every per-type and per-destination cap;
- prevent immediate duplicate destinations and revisit a physical destination
  only when the explicit bounded revisit setting permits it;
- permit multiple distinct affordable vendor stops, at most one purchase per
  vendor visit, deduct each completed purchase from remaining budget, and keep
  dwell separate from queue waiting;
- apply the documented affordability and price formula;
- select stages by attraction and supported amenities by configured weight;
- resolve type-level dwell defaults and optional per-location overrides once;
- generate one or two seeded in-bounds waypoints for explorers;
- emit the approved destination/dwell events and frame targets;
- emit typed bounded exits for limits, eligibility, time, budget, queue
  tolerance, seeded post-stop decisions, and run end;
- preserve SIM-02 queue, inventory, purchase, abandonment, and ordering rules;
  and
- keep every output deterministic, immutable, and JSON-serializable.

After the SIM-03 ledger is stable, implement ANA-03 under
`src/analytics/destinations/**`. Derive visits and dwell only from ordered
events, include zero-demand destinations in stable ID order, and do not
duplicate ANA-01 vendor formulas.

## Demo acceptance

The expanded P0 is ready when a reviewer can:

1. load a festival containing a stage, two vendors, seating, restroom, and
   first aid;
2. edit a vendor price and a small set of behavior assumptions;
3. run 200–300 deterministic attendees and visibly observe the supported intent
   mix;
4. see stage/vendor/roam/amenity movement plus vendor queue/service behavior;
5. rerun an alternative with the same profiles, intent assignments, seed, and
   behavior settings;
6. inspect event-reconciled vendor and destination results; and
7. understand that prices, visits, revenue, and recommendations are modeled
   estimates rather than forecasts.
