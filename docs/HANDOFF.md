# Setup status and developer handoff

## Prepared locally

- Minimal Next.js/React/TypeScript scaffold with Tailwind, Konva, Recharts, pure-rand, Vitest, linting, and a lockfile.
- Shared v1 domain and simulation contracts plus one festival fixture.
- Product, research, architecture, reuse, tasks, integration, testing, collaboration, deployment, and decision documentation.
- Four project Codex agent definitions:
  - `.codex/agents/simulation-engineer.toml`
  - `.codex/agents/frontend-engineer.toml`
  - `.codex/agents/integration-reviewer.toml`
  - `.codex/agents/open-source-researcher.toml`
- Three validated project skills:
  - `.agents/skills/rushlab-open-source-evaluation/SKILL.md`
  - `.agents/skills/rushlab-simulation-verification/SKILL.md`
  - `.agents/skills/rushlab-integration-review/SKILL.md`

Installed Codex CLI `0.165.0-alpha.1.2` recognizes the current custom-agent/config format from the 2026-11-13 official manual. Skills passed the bundled `quick_validate.py` validator.

## Verification results

```text
npm run lint       pass
npm run typecheck  pass
npm test           1 file / 2 tests pass
npm run build      pass (Next.js 16.4.6, webpack, static / route)
npm audit --omit=dev  0 vulnerabilities
```

Full `npm audit` reports seven moderate, development-only `minimatch` findings through the current Next.js lint toolchain. Do not run a blind audit fix during the hackathon; monitor/upstream-update after compatibility is confirmed.

Third-party verification:

```text
jphinspace/festival: 620/620 tests passed; HTTP/module launch passed
anesask/discrete-sim: 797/797 tests, typecheck, and build passed
```

The managed sandbox blocked Turbopack's internal CSS worker from binding a port, so the reproducible build command uses `next build --webpack`. This is an environment/tooling workaround, not a product-feature failure.

## Human approval or external setup still required

1. Approve the architecture and begin product implementation.
2. Create/select the GitHub remote, choose repository visibility/license, push this initial state, and invite the second developer.
3. Agree which human is Developer A and Developer B.
4. Review and merge CP1 contract freeze before parallel feature branches.
5. Connect Vercel and approve the first preview/production deployment.
6. Approve any later Supabase project, OpenAI API use, paid resource, custom domain, new production dependency, or third-party code port.
7. Decide whether the development-only audit findings are acceptable for the weekend or should wait for upstream package updates.

No remote, account, deployment, database, API key, or paid resource was created.

## Exact next prompt — Developer A

```text
Implement task UI-01 from docs/TASKS.md on branch codex/ui-01-map-editor. Read AGENTS.md, docs/ARCHITECTURE.md, docs/INTEGRATION.md, and the frozen types in src/domain first. Own only src/app, src/components, and src/features/editor. Build a client-side Konva map for demoFestival with meter-to-pixel conversion, responsive stages/entrance/path/vendor layers, bounded vendor dragging, and one accessible vendor attribute form. Do not add state libraries, simulation logic, or change shared contracts. Add focused transform/bounds tests and run npm run verify. Stop and report the smallest proposed change if a shared contract blocks you.
```

Recommended Codex agent: `frontend_engineer`. Use GPT-6.1 Sol medium reasoning for the first integration; a faster model is fine for later polish.

## Exact next prompt — Developer B

```text
Implement task SIM-01 from docs/TASKS.md on branch codex/sim-01-seeded-engine. Read AGENTS.md, docs/ARCHITECTURE.md, docs/TESTING.md, and src/domain first. Own only src/simulation and adjacent tests. Add a pure-rand wrapper with stable named streams, deterministic attendee profile generation, a fixed-step engine skeleton, simple valid waypoint movement, and the concrete runSimulation export matching the frozen RunSimulation type. Never call Math.random or import React/DOM code. Prove same-seed equality, different-seed inequality, named-stream independence, monotonic time, and in-bounds positions. Run npm run verify. Stop and report the smallest proposed change if a shared contract blocks you.
```

Recommended Codex agent: `simulation_engineer` plus the `rushlab-simulation-verification` skill. Use GPT-6.1 Sol high reasoning for invariants.
