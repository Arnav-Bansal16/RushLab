# Current implementation and expanded P0 handoff

## Current checkpoint — 2026-11-14

Start with [UI-04 consolidated handoff](./UI-04-CONSOLIDATED-HANDOFF.md) and
[the updated task plan](./TASKS.md). Fetched main `785ed94` includes UI-04/demo
PR #10 and queue-retention PR #11, in addition to merged SIM-03 (#8/#9), CON-02
and the earlier simulation/vendor-analytics/playback slice.

The app supports behavior editing, canonical amenities, deterministic bounded
price/budget-sensitive visits and timed playback. The user-requested extension
retains queue leavers for another eligible choice, marks frustration/full queues,
records modeled missed-sale attempts and paces business figures with playback.
That extension crossed original UI-04 ownership into shared contracts,
simulation and analytics; TASKS tracks it as merged EXT-01, not future work.

Latest implementation evidence: verify passed 182 tests, lint, types and build.
Complete manual accessibility/lifecycle checks and fresh 300-guest FPS/runtime/
payload measurement remain outstanding. ANA-03 destination summaries, UI-03 full
results dashboard, INT-01 comparisons, ANA-02 recommendations and REL-01 remain
next steps. The demo's stall table does not complete those tasks.

PR merge presence is verified; both-developer approvals are not independently
verified from empty review-list results. Follow normal joint review for new
shared-contract changes; do not infer a retrospective gate from absent records.

The sections below preserve the original expanded-P0 plan. Current source,
TASKS and consolidated handoff supersede outdated implementation-status claims.

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
