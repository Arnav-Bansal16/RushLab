# RushLab

RushLab is a planned browser-based festival operations simulator. Organizers will edit vendor placements, run deterministic attendee scenarios, compare business outcomes, and receive evidence-backed placement recommendations.

This repository currently contains the approved-for-review architecture, shared TypeScript contracts, team workflow, and a minimal Next.js scaffold. It intentionally does **not** implement the product simulation or dashboard yet.

## Architecture decision

Build a small RushLab-specific TypeScript simulation engine and reuse focused libraries for rendering and charts. Do not fork the existing festival simulator. See [docs/DECISIONS.md](docs/DECISIONS.md) and [docs/REPOSITORY_RESEARCH.md](docs/REPOSITORY_RESEARCH.md).

## Local setup

Requirements: Node.js 20+ and npm.

```bash
git clone <repository-url>
cd rushlab
cp .env.example .env.local
npm ci
npm run dev
```

Open `http://localhost:3000`.

Before a pull request:

```bash
npm run verify
```

## Start here

- Product scope: [docs/PRODUCT.md](docs/PRODUCT.md)
- Architecture and contracts: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- Ordered work: [docs/TASKS.md](docs/TASKS.md)
- Two-person workflow: [docs/COLLABORATION.md](docs/COLLABORATION.md)
- Exact developer handoff: [docs/HANDOFF.md](docs/HANDOFF.md)
- AI contributor rules: [AGENTS.md](AGENTS.md)

Simulation outputs are modeled estimates under explicit assumptions, not attendance or revenue forecasts.
