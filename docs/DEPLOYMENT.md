# Deployment and external setup

## P0 design

Deploy the single Next.js app to Vercel. Simulation, playback, metrics, and demo data run in the browser. No database, authentication, model API, or paid service is required.

## Local environment

```bash
cp .env.example .env.local
npm ci
npm run dev
```

`.env.local` is ignored. Never commit API keys. Only variables prefixed `NEXT_PUBLIC_` may reach browser code; therefore secrets must never use that prefix.

## GitHub and Vercel setup requiring a human

1. Create or choose the GitHub repository; add both developers with write access and enable pull requests.
2. Import the repository in Vercel.
3. Accept detected Next.js settings; do not override build/output unless a real failure requires it.
4. Set `NEXT_PUBLIC_DEMO_MODE=true` for Preview and Production.
5. Leave Supabase/OpenAI variables unset for P0.
6. Confirm every PR creates a preview and `main` deploys production.

CLI deployment is optional and requires explicit approval/account login:

```bash
npx vercel link
npx vercel env pull .env.local
npx vercel deploy
```

This repository setup did not run those commands or create accounts/resources.

## Preview checklist

- `npm ci` and `npm run verify` pass locally.
- Preview opens without authentication.
- No secret or environment dump appears in the browser bundle/logs.
- Demo loads without network-dependent data.
- Edit → baseline → alternative → comparison → recommendation works after refresh.
- Browser console has no uncaught errors.
- “Modeled estimate” and assumptions are visible.

## Optional P1/P2 variables

If approved later, server-only `OPENAI_API_KEY` may support explanations. Supabase typically requires public URL/anon key plus a server-only service key; the service key must never enter client code. Before enabling saves, define versioned tables, Row Level Security, retention, and deletion behavior.

## Production checklist

- Freeze P0 and merge only green PRs.
- Run the demo script on the exact preview.
- Promote the verified deployment or merge to `main`.
- Record commit SHA and demo URL.
- Keep a local fallback recording/screenshots and a known-good branch.
- Do not provision a custom domain or paid plan unless the team explicitly approves it.

## Optional organizer accounts (explicitly requested after the original P0)

See `docs/ORGANIZER-ACCOUNTS-SETUP.md` for the Supabase migration, public
configuration, email redirect URLs and required two-account access checks.
Cloud templates require that setup; the guest workspace does not. Use Node.js
22+ for the current official SDK. No cloud project or deployment was created.
