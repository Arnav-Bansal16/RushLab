# Demonstration attendee and frustration retention

User requested more visibly frustrated guests and no attendee exits until the
end. User explicitly authorized shared-contract implementation with review
before merge after being shown AGENTS.md's joint ownership requirement.
**Joint developer review remains required before merge.** This is a separate
behavior extension, not an assertion of original UI-03 or release acceptance.

## Behavior

- New optional `BehaviorSettings.retainAttendeesUntilEnd` resolves false; only
  the existing festival demo enables it by default. Validator accepts booleans.
- Existing stop, revisit, affordability and individual visit-time limits remain
  in effect. Once activity ends, engine sets dwelling/stayingUntilEnd with no
  target or active visit and no further synthetic visit or sale events.
- All attendees stay inside until the global duration, then normal cleanup
  emits one run_ended exit per attendee and releases queue/server membership.
- Actual queue-frustration markers persist until closing in this opt-in mode.
  Ordinary runs retain the 15-second marker policy. Closing clears retained
  markers, so the final exited frame has zero visible frustration.
- The visible count is guests with an engine-recorded queue-frustration
  experience during the event, not invented anger or repeated attempt counts.
  Retention is a deliberate modeled assumption, not a forecast of emotion.

## Changes and integration

`src/domain/behavior.ts`: additive optional setting, false default, validation.
`src/domain/simulation.ts`: additive optional stayingUntilEnd frame marker and
clarified frustration lifetime. No shared fixtures were edited.
`src/simulation/runSimulation.ts`: all departure plans respect opt-in retention;
frame snapshots apply explicit retention lifetime; end-of-run clears idle flag.
`src/features/playback/vendorDemo.ts`: opt in without further demand/price changes.
`presentation.ts`, `PlaybackView.tsx`, `PlaybackWorkspace.tsx`, and
`simulation-settings/ResolvedAssumptions.tsx`: explain retained experiences and
idle-on-site state using engine frame data and saved resolved settings.
Architecture and integration docs record the scoped extension.

Complete behavior settings remain subject to INT-01's exact comparison guard.
Normal and retained runs cannot be presented as compatible. Capacity comparison
reuses the same retention setting/profiles/demand; ranking and metric reducers
remain canonical and unchanged. No network, dependencies, random calls or UI
reconstruction of engine states were introduced.

## Verification

New `src/simulation/eventEndRetention.test.ts` checks real 300-person retention,
more than 100 genuinely event-supported red markers before closing, exact
per-frame agreement with attendee IDs that experienced queue departures,
absence of early exits, all final exits/zero final queues, bounded stops/budgets,
event/purchase/revenue agreement, input immutability, deterministic replay,
normal 15-second lifetime, default/boolean validation and incompatibility with
normal-retention settings. Existing conservation and metrics suites remain
part of full verification.

Targeted domain/dashboard/playback/queue-retention tests: 66 tests / 15 files
passed. Full verification and browser observations are recorded below.

Final verification: `npm run verify` passed lint, types, 287 tests across 34 files,
and production build. `git diff --check` passed. The editor handoff regression
now explicitly expects the new resolved false default; fixture inputs remain
unchanged.

Browser: local ChatGPT in-app browser, real 300-person demo. At 9:54 / 10:00,
Frustrated now showed **201**, with the explanation that these guests experienced
queue frustration during the event. At exactly 10:00 it showed zero, matching
closing exits. Scrubbing back restored 201. The browser was left paused at
9:54 with the high-count view visible. These checks validate playback of saved
engine frames, not a continuous-emotion or crowd-safety forecast. No merge or
deployment was performed; joint review remains outstanding before merge.

## Demo presentation update — 2026-11-15

User requested removal of the long Run & Review assumptions paragraph, the
extra busier-event description and the expanded Watching example explanation.
Removed those passages; saved assumptions and modeled-result qualifications
remain accessible elsewhere. Demo queue patience is restored to the normal
multiplier 1, and waiting capacity is three per vendor (active service excluded).
Retain-until-closing behavior remains enabled. Updated regression compares
full-queue events with capacity 20 at identical normal patience/profiles.

The demo's primary after column is now explicitly an **illustrative 20%
improvement target**, not canonical simulation output. The separate
analytics/metrics/demoTargets helper derives display-only targets: purchases
rounded from +20%, revenue +20%, missed opportunity value and affected vendor
wait -20%. Missing evidence stays unavailable. Targets never enter canonical
comparison, ranking, saved results, events or playback. Actual retained paired
comparisons remain in the detailed evidence; ordinary non-demo runs retain
their calculated summary. The visible caption identifies illustrative values.

The login route is now a demo entry page: its Sign in link goes straight to
/workspace, with no form, credential collection, verification or auth request.
The cloud integration source remains available separately but is not used by
this demo entry. Live account setup/activation is not claimed.

Browser checked direct sign-in navigation, shortened descriptions, a real demo
run and target values: purchases 64 → 77; revenue 351.00 → 421.20; opportunity
value 2,031.00 → 1,624.80; Taco Kitchen wait 91.70 → 73.36 seconds. After values
are visibly labeled illustrative targets. Full verify passed 297 tests across
37 files, lint, types and build. git diff --check passed.

### Further demo copy simplification

Removed the target-assumptions paragraph and the ranking/evidence disclosure
from the demo report. Non-demo reports retain canonical evidence; illustrative
demo values still carry their explicit illustrative label. Restored drafts no
longer emit the lengthy Opened Unsaved draft footer message.

Demo sign-in now shows optional username/password fields. They have no names,
are never read/sent/stored, and submitting empty or filled fields navigates to
/workspace without auth. Browser checked both cases and absence of the removed
demo text. Full verify passed 297 tests, lint, types and build; diff check passed.
