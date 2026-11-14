# Product and MVP scope

## Customer and promise

RushLab serves small-to-medium recurring festival organizers coordinating several vendors. It answers: where should vendors go, which queues or vendors need attention, and how did an alternative layout perform under the same modeled assumptions?

The demo must show business value, not merely animated dots.

## P0 — must work

- One predefined festival with stages, entrance, paths, obstacles, and vendors.
- Drag vendor positions and edit category, popularity, price, inventory, servers, and service time.
- Generate 200–300 attendees with seeded preferences, budgets, arrivals, and queue tolerance.
- Plausible waypoint/path movement; accurate queue, service, purchase, abandonment, and stockout behavior.
- Sparse playback frames plus vendor revenue, purchases, average wait, peak queue, utilization, and abandonment.
- Baseline versus one alternative using identical attendee profiles and compatible settings.
- Rule-based placement/capacity recommendations with metric evidence.
- Public Vercel demo with no login.
- Visible assumptions and “modeled estimate” language.

P0 does not require scientifically validated pedestrian dynamics or global mathematical optimization.

## P1 — only after P0 deploys

- Congestion/activity overlay.
- Historical/vendor CSV import with validation.
- Export result JSON/CSV.
- LLM explanation of structured results; calculations remain deterministic.
- Better bounded candidate search for recommendations.
- Web Worker only if profiling shows main-thread stalls.

## P2 — defer

- Authentication, saved projects, and Supabase.
- Arbitrary venue authoring and multiple templates.
- Advanced collision/crowd-flow models.
- Multi-run uncertainty intervals and staff schedules.
- PDF reports and organization collaboration.

## Feature freeze and cuts

Freeze features when the deployed demo can edit one vendor, run 200–300 attendees, show vendor outcomes, compare one alternative, and explain one recommendation. After that, accept only fixes and demo polish.

Cut in this order: LLM, CSV, heatmap, arbitrary path editing, persistence/auth, sophisticated local avoidance. Never cut determinism, event-derived metrics, or scenario comparison.

## Success criteria

- A judge can move a vendor and understand the modeled business effect in under three minutes.
- Identical inputs and seed produce identical events and metrics.
- Metrics can be traced to simulation events.
- The repository stays runnable at every integration checkpoint.
