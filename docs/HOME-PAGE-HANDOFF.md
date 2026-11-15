# RushLab introduction page

The root route `/` now introduces RushLab to festival and market organizers.
The existing editor, simulation and report are at `/workspace`. All home-page
calls to action link there; the editor brand links back home.

Design: cream, forest green and terracotta; editorial serif headings; original
inline SVG venue illustration explicitly labeled illustrative; design → simulate
→ compare introduction and a brief modeled-results qualification. No invented
customer claims, benchmark statistics, AI claims, imagery requests, external
fonts, dependencies or network calls were added. Styles use a CSS module to
avoid changing the existing editor's design.

Files: `src/app/page.tsx`, new `src/app/home.module.css`, new
`src/app/workspace/page.tsx`, narrow brand link in FestivalEditor.tsx.
Existing uncommitted simulation/dashboard work was preserved.

Verification: `npm run verify` passed lint, types, all 287 tests and production
build, including static generation of `/` and `/workspace`. `git diff --check`
passed. Browser checks at 1280 × 900 and 390 × 844: both hero layouts inspected;
390px document width equals viewport width. Open RushLab reaches the editor;
brand returns home; Take a look around reaches the workflow section. Temporary
viewport reset; home left open. This is a local implementation, not deployment.

## Waitlist integration — 2026-11-15

Verified the supplied Rush Lab Waitlistr page in the browser. Added the exact
hosted signup URL to the home-page navigation, hero and a dedicated waitlist
section. All links open a new tab with noopener/noreferrer and accessible
new-tab labels. The section identifies Waitlistr as the signup destination.
Workspace access remains available. No third-party form was recreated, no
member count was hard-coded, no visitor was signed up, and no visitor data is
submitted until they choose to complete Waitlistr's own flow.

URL: https://www.waitlistr.com/lists/9f7e9a3a/rush-lab

Verified all three destination URLs and mobile layout at 390 × 844 (document
width 390). Full verify passed lint, types, 296 tests / 36 files and build.
Local home page was left open. No deployment was performed.

## Editor-space follow-up

The screenshot's editor region now uses one 280px tools rail (creation above
inspector) with a larger venue panel alongside it at desktop widths. MapCanvas
uses the actual venue aspect ratio, bounded height and 16px rendering inset;
world coordinates and editing transforms are unchanged. Simulation-input/JSON
controls are a native collapsed disclosure. The unconfigured cloud toolbar is
not rendered; its draft-restoration hook still runs. Configured cloud controls
remain available. Header, map-footer and panel padding are tighter.

Full verify passed 299 tests, lint, types and build. Browser observed the
rearranged tools, a roughly 1088px-wide editor map at 1439 CSS px, successful
example loading and Taco Stand selection. The preview was heavily zoomed out,
so responsive observations used measured CSS widths rather than assuming the
viewport override equaled CSS pixels. Intermediate 727px width had no document
overflow. Temporary viewport override cleared. No simulation changes.
