# Two-person GitHub and AI workflow

GitHub and committed files are the common source of truth. Separate computers and AI chats do not share conversational memory.

## Concepts

- **Separate computers:** independent clones, dependencies, uncommitted files, and AI context.
- **Git branches:** reviewable histories that synchronize through push/pull requests.
- **Git worktrees:** multiple checked-out branches on one computer; useful for local parallel agents, irrelevant across two computers.
- **Subagents:** separate short-lived contexts inside one Codex task; they do not replace branches or communicate automatically with another developer's session.

## Initial setup

One human must create the GitHub repository and add the other as collaborator; this setup intentionally did not create a remote.

On each computer:

```bash
git clone git@github.com:<org-or-user>/rushlab.git
cd rushlab
git switch main
cp .env.example .env.local
npm ci
npm run verify
```

Configure identity if needed:

```bash
git config user.name "Your Name"
git config user.email "you@example.com"
```

## Ownership

- Developer A: `src/app/**`, `src/components/**`, `src/features/**`, browser integration, Vercel.
- Developer B: `src/simulation/**`, `src/analytics/**`, engine tests/benchmarks.
- Joint, one PR at a time: `src/domain/**`, `src/fixtures/**`, package/config files, architecture decisions.

The expanded P0 has a second shared checkpoint, CON-02. Finish and merge the
current SIM-02/UI-02/ANA-01 vertical slice first. Then both developers review
and merge CON-02 before starting behavior implementation. Do not independently
extend settings, attendee profiles, events, frames, amenities, or result
metrics on a feature branch.

## Daily branch loop

Developer A example:

```bash
git switch main
git pull --ff-only origin main
git switch -c codex/ui-01-map-editor
npm test
# Work in one Codex/Claude chat scoped to UI-01.
npm run verify
git add src/features/editor src/components src/app
git commit -m "feat(editor): add festival map editing slice"
git push -u origin codex/ui-01-map-editor
gh pr create --fill --base main
```

Developer B uses the same flow with `codex/sim-01-seeded-engine` and stages only owned files.

Reviewer checks task acceptance criteria, contract drift, and `npm run verify`, then merges via GitHub. After merge:

```bash
git switch main
git pull --ff-only origin main
git branch -d codex/ui-01-map-editor
```

If the remote branch is no longer needed:

```bash
git push origin --delete codex/ui-01-map-editor
```

## Expanded P0 branch sequence

Keep the new work to four reviewable branches rather than one cross-layer PR:

1. `codex/con-02-behavior-contract` — joint contract, fixture, and planning
   update; no engine or UI implementation.
2. `codex/sim-03-attendee-behavior` — Developer B owns deterministic intent,
   price elasticity, bounded roaming, destination visits, and simulation tests.
3. `codex/ui-04-behavior-controls` — Developer A owns vendor price editing,
   advanced settings, and playback presentation after CON-02 merges.
4. `codex/ana-03-destination-metrics` — Developer B starts only after SIM-03
   fixes the destination event ledger.

SIM-03 and UI-04 may run in parallel after CON-02 because they own disjoint
files. ANA-03 must not run in parallel with SIM-03 event-contract changes.
Choose one integrator for final app composition and INT-01 compatibility rules.
Every PR rebases on current `main`, runs targeted tests, then runs
`npm run verify`; no branch should contain opportunistic shared-contract edits.

## Updating a branch and resolving conflicts

Prefer small PRs and update before integration:

```bash
git fetch origin
git rebase origin/main
npm run verify
git push --force-with-lease
```

On conflict, identify the owning developer. For shared contracts, stop and resolve together; do not accept one side wholesale. Edit conflict markers, run tests, then:

```bash
git add <resolved-files>
git rebase --continue
```

Use `--force-with-lease`, never plain `--force`. Never rewrite `main`.

## Worktrees and local agents

For two local tasks on one machine:

```bash
git worktree add ../rushlab-ui -b codex/ui-task main
git worktree add ../rushlab-review -b codex/review-task main
```

Assign each agent a different worktree and non-overlapping files. Remove a completed clean worktree with `git worktree remove ../rushlab-review`. Do not use worktrees as a substitute for pushing work.

## Codex and Claude Code

Both tools share `README.md`, `AGENTS.md`, `docs/`, types, tests, and Git history. Codex additionally discovers `.codex/agents/*.toml` and `.agents/skills/*/SKILL.md`. Claude should be prompted to read `AGENTS.md` and the assigned task; do not assume Codex TOML or skill invocation works unchanged in Claude Code.

Keep one chat per task. Prompt with goal, relevant files, constraints, done criteria, and test command. Use a stronger reasoning model for contracts, engine invariants, integration, and hard debugging; use a faster model for narrow UI copy, fixtures, lint fixes, and documentation. Stop an agent after two repeated failed fixes or when it starts changing shared interfaces without authorization; reduce the reproducer or take over manually.

Subagents and skills do not bypass model usage limits; parallel runs usually consume more tokens.

## Model and context efficiency

- Start with GPT-6.1 Sol at medium/high reasoning for architecture, contract review, engine invariants, scenario fairness, and cross-layer debugging when the account has access.
- Use GPT-6 Luna for narrow, well-specified scans, simple fixtures, documentation cleanup, or mechanical lint/test fixes.
- Custom agent files intentionally inherit the parent model so both developers are not blocked by different account availability. Select a model per chat instead of hard-coding it in the repository.
- Give an agent the task ID and relevant folders; do not paste all project documentation. `AGENTS.md` routes it to the correct source.
- Prefer targeted tests during iteration and the complete merge gate once. Share summarized failures, not full repeated logs.
- Parallelize independent read-heavy research and disjoint owned folders. Keep contract decisions and final integration serial.

Official basis: [Codex best practices](https://learn.chatgpt.com/guides/best-practices), [subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents), [AGENTS.md](https://learn.chatgpt.com/docs/agent-configuration/agents-md), [skills](https://learn.chatgpt.com/docs/build-skills), and [worktrees](https://learn.chatgpt.com/docs/environments/git-worktrees). Current documentation notes that subagents have independent contexts and consume additional tokens.
