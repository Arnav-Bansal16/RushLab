# Current implementation and expanded P0 handoff

## Current checkpoint — 2026-11-15

PR [#17](https://github.com/Arnav-Bansal16/RushLab/pull/17) is merged into
main (`2fc7201`). It includes the home page and Waitlistr links, demo sign-in,
saved-run reporting, optional cloud-template infrastructure and demo retention.
The follow-up branch `codex/demo-randomization-and-compact-layout` contains:

- A fresh browser-generated seed on each **Try the 8-vendor demo** action.
  Immediate duplicate draws are avoided. The engine remains deterministic;
  replaying a saved run does not rerun it, manual settings remain editable, and
  baseline/alternative evaluations keep compatible seeds and assumptions.
  Different seeds can occasionally produce equal aggregate totals.
- A compact editor with creation and inspection in one desktop tools rail,
  a larger map fitted to the venue aspect ratio, and collapsed simulation JSON
  controls. The unconfigured cloud toolbar is hidden. Draft restoration and
  configured cloud controls remain available; world geometry is unchanged.
- Side-by-side playback and final results on wide screens, with stacked panels
  on smaller screens and tighter header/panel spacing.

The main demo flow is `/` → `/login` → `/workspace` → **Try the 8-vendor demo**.
Username and password are optional demo inputs and are never read or stored.
The demo uses 300 guests, normal patience, three waiting spaces per vendor and
retention until closing. The demo improvement statistics table is visible without
a Before and after heading or introductory paragraph. Its columns identify
simulated before-values and illustrative after-targets (approximately 20%
improvements). Non-demo reports retain calculated comparison evidence.

Supabase is not configured. Real authentication, cross-device templates and
two-account RLS isolation require setup and live verification; see
[organizer account setup](./ORGANIZER-ACCOUNTS-SETUP.md). Performance/release
acceptance and deployment remain separate. Merge presence does not establish
that both developers reviewed the shared retention contracts.

Verification: `npm run verify` passed lint, types, 299 tests across 38 files and
production build. New tests cover fresh/deduplicated/wrapped seeds, immutable
settings, differing real profiles/events and deterministic repeat runs.
Browser checks covered repeated demos, desktop playback/results, responsive
stacking, editor example loading and component selection. Detailed observations
and limitations are in [demo handoff](./DEMO-RETENTION-HANDOFF.md) and
[home/editor handoff](./HOME-PAGE-HANDOFF.md).

## Previous checkpoint — 2026-11-14

Start with [UI-04 consolidated handoff](./UI-04-CONSOLIDATED-HANDOFF.md) and
[the updated task plan](./TASKS.md). Fetched main `785ed94` includes UI-04/demo
PR #10 and queue-retention PR #11, in addition to merged SIM-03 (#8/#9), CON-02
and the earlier simulation/vendor-analytics/playback slice.

INT-01 now has a canonical compatibility guard and final-result comparison
contract. See [INT-01 handoff](./INT-01-HANDOFF.md) for the exact hard-error
policy, metric representation, and ANA-02/UI-03 consumer boundary.
ANA-02 and UI-03B should continue from the focused
[downstream handoff](./INT-01-ANA-02-UI-03B-HANDOFF.md).

The app supports behavior editing, canonical amenities, deterministic bounded
price/budget-sensitive visits and timed playback. The user-requested extension
retains queue leavers for another eligible choice, marks frustration/full queues,
records modeled missed-sale attempts and paces business figures with playback.
That extension crossed original UI-04 ownership into shared contracts,
simulation and analytics; TASKS tracks it as merged EXT-01, not future work.

Latest merged implementation evidence: verify passed 182 tests, lint, types and
build. Complete manual accessibility/lifecycle checks and fresh 300-guest
FPS/runtime/payload measurement remain outstanding. ANA-03 destination
summaries are committed on `codex/ana-03-destination-metrics` and await normal
merge/integration. INT-01, the expanded ANA-02 issues/candidate work, UI-03 and
REL-01 follow. The demo's stall table does not complete those tasks.

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
6. Finish INT-01's fair-comparison checks, then expand ANA-02 into the
   deterministic issues report and bounded candidate-layout evaluator described
   in `docs/TASKS.md`.
7. Integrate UI-03 with canonical metrics, issues, candidate changes, and raw
   before/after evidence; UI code must not recalculate findings or scores.
8. Run the full CP4 report flow, `npm run verify`, the 300-attendee playback
   check, and the capped candidate-search benchmark before feature freeze.

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
7. generate an evidence-backed issues report and an editable best-tested
   candidate layout;
8. inspect absolute and percentage baseline-versus-candidate changes, including
   an explicit unavailable state for zero-denominator percentages; and
9. understand that prices, visits, revenue, issues, and recommendations are
   modeled estimates rather than forecasts, and that the candidate is not a
   proven global optimum.
