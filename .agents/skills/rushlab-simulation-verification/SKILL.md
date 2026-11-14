---
name: rushlab-simulation-verification
description: Verify RushLab simulation correctness and reproducibility. Use when implementing or reviewing engine, queue, metric, comparison, or recommendation behavior.
---

# RushLab simulation verification

Read the applicable contracts in `src/domain` and requirements in `docs/TESTING.md` before changing tests or engine behavior.

Verify the smallest relevant layer, then the integrated invariant:

- identical inputs and seed produce identical profiles, events, frames, and metrics;
- named RNG streams remain independent and engine code never calls `Math.random()`;
- time and ID ordering are stable;
- queue membership, server occupancy, purchases, inventory, and exits are conserved;
- purchases cannot occur after stockout and service capacity affects throughput;
- event-derived metrics reconcile exactly with the ledger;
- comparisons reuse profiles and compatible settings or surface a warning;
- recommendations stay within placement constraints and cite metric evidence.

Use targeted deterministic fixtures and several explicit seeds. Avoid brittle snapshots of wall-clock runtime or full large frame arrays. Apply minimal fixes only when the user asked to fix; otherwise report evidence and reproduction steps.

Done means targeted tests pass, `npm run typecheck` passes, and any remaining uncertainty or performance limitation is stated.
