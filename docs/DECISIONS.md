# Architecture decisions

| ID | Decision | Rationale | Revisit when |
|---|---|---|---|
| D-01 | Build a lightweight RushLab-specific engine (Approach C). | The existing festival app is canvas-coupled, hard-coded, unseeded, and lacks commerce/scenario outputs. A narrow typed core is faster to integrate and maintain. | A verified library removes more work than it adds. |
| D-02 | Run P0 entirely in the browser. | Simplest demo, no service operations, compatible with Vercel, and adequate for 200–300 non-physics agents. | Measured runs block interaction or exceed memory targets. |
| D-03 | Fixed-step deterministic TypeScript engine, independent of React. | Fair comparisons, easy unit tests, and parallel UI/engine development. | Never for P0; the API may later gain worker transport. |
| D-04 | Konva/react-konva for editing and playback; PixiJS only as a fallback. | Konva supplies drag, transforms, hit testing, and React integration. | A benchmark shows the P0 scene misses the frame-rate target. |
| D-05 | Events are canonical; frames are sparse presentation data. | Prevents metric drift and keeps playback payload bounded. | Only if storage/performance evidence demands another representation. |
| D-06 | Use `pure-rand` for seeded PRNG streams. | Small, maintained, browser-safe, and purpose-built for reproducible state. | A security/maintenance issue appears. |
| D-07 | No Supabase, auth, or LLM in P0. | They do not prove the core value and add failure modes. | P0 is deployed and time remains. |
| D-08 | World coordinates are meters; renderer owns pixel conversion. | Prevents movement, travel time, and layout math from depending on viewport size. | Never without a versioned contract migration. |
| D-09 | Two developers share contracts but own disjoint implementation folders. | Reduces merge conflicts and enables parallel work after the contract freeze. | Ownership blocks progress and both developers agree to change it. |

Decision D-01 was informed by local verification of `jphinspace/festival` (620 passing tests) and `discrete-sim` (797 passing tests). Both are valuable references; neither is the P0 runtime foundation.
