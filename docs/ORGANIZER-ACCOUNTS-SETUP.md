# Organizer accounts and private cloud layout templates

The user explicitly requested real organizer accounts with templates available
across devices. This extends the original local-only P0 scope. Supabase project
creation remains the user's next step; no remote database or user was created.
The integration is implemented but not yet activated or end-to-end verified
against a real project. Unconfigured screens state that cloud saving is not
available rather than simulating success.

## Connect the project

1. Create a Supabase project using your own account. Keep its database password
   and secret/service-role keys private; RushLab does not need them.
2. Apply `supabase/migrations/202611150001_layout_templates.sql` once through
   the project's SQL editor or normal Supabase migrations. It creates the
   layout_templates table, access policies and update timestamp trigger.
3. Enable email/password sign-in and email confirmation in Supabase Auth.
4. Configure the Auth site URL to the actual RushLab origin. For the current
   local server use `http://localhost:3001`; add these exact redirect URLs:
   - `http://localhost:3001/templates`
   - `http://localhost:3001/reset-password`
   Add corresponding HTTPS URLs when deploying. Do not add an unrestricted
   wildcard redirect for production.
5. Copy the project URL and public publishable key from Supabase's project
   connection/API settings to an ignored `.env.local` file:

   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLIC_PUBLISHABLE_KEY
   ```

   The SDK also accepts a legacy public anon key in that same variable. Never
   use a service-role/secret key in either client variable. The application
   verifies users and relies on database RLS, not secrecy of a public key.
6. Restart the development server. For production, set the same public variables
   in the hosting environment and rebuild. Use Node.js 22 or later, required by
   the installed official SDK (the project engine declaration was updated).
7. Create two test accounts and complete the live checks below before release.

The Supabase integration can also be used to apply the migration after the user
connects it and identifies the intended project. It was suggested, but there is
no confirmed connection/project in this chat. No project ID was guessed.

## User flow

- `/login`: styled email/password sign-in, account creation, confirmation-email
  state and password-reset requests. No password is stored by application code.
- `/reset-password`: updates a password using the authenticated recovery session.
- `/templates`: user's own saved templates, empty/loading/error states, sign out
  and links to open templates or start a new event.
- `/workspace`: remains available without an account. The new toolbar signs in
  to save, names templates, updates a selected template or saves an independent
  copy. The library opens `/workspace?template=<id>`.
- Saved data is the entire validated LayoutDocument, including editor labels,
  colors and custom annotations. Incomplete drafts without an entrance can be
  saved; simulation validation still runs separately before a simulation.
- Saving snapshots the submitted layout before asynchronous work. Later edits
  do not change the submitted snapshot. Cloud loading replaces only the editor
  draft, clears stale selection and retains undo and completed simulation data.
- Navigation to sign-in/library preserves an unsaved draft temporarily in the
  tab's sessionStorage. This is a bridge, not a cloud save. Owned drafts cannot
  be restored into another signed-in account. The pending copy is consumed once.
- Templates store layouts only, not simulation results, settings, credentials,
  attendee profiles or purchase ledgers. No autosave, sharing or deletion is
  included in this scope.

## Access boundary

The SDK session handles authentication and token refresh. Database operations
call `auth.getUser()` and filter by that verified ID. The migration enables and
forces RLS, revokes anonymous table access and allows authenticated users to
select/insert/update only rows whose owner_id equals auth.uid(). Update policies
also prevent transferring a row to another owner. No delete/public/share policy
is installed. Auth-user deletion cascades its templates.

Rows contain UUID id/owner_id, name (1–80 trimmed characters), format_version=1,
complete editor document, and server-created timestamps. Payloads are limited
to 1 MB, version checked, validated and cloned before entering the editor. Names
are rendered as text. Client filters are additional defenses, not substitutes
for database RLS.

## Verification

- Nine new tests cover full fixture/editor-annotation round-trip, blank drafts,
  corruption and size/version rejection, verified ownership, denied access,
  submitted-snapshot isolation, save failures, account-isolated temporary drafts,
  login/signup/reset presentation and truthful unconfigured behavior.
- `npm run verify`: lint, typecheck, 296 tests in 36 files and production build
  passed, including `/login`, `/templates` and `/reset-password` static routes.
- These storage tests use an injected SDK double. They establish application
  behavior, not proof that RLS is installed in an external project.
- Live signup, email confirmation/recovery, refresh/signout, cross-device save,
  and account-A-vs-account-B database isolation are still pending project setup.
  Specifically verify B cannot list/read/update A's UUID even through direct
  authenticated database requests; anonymous access must also be denied.
- Check non-destructive failures by temporarily disconnecting the network:
  failed saves must retain the draft and never show a success message.

## Dependency evaluation

Added the official `@supabase/supabase-js` 2.119.0, exact pinned version, MIT
license (Copyright 2020 Supabase). Inspected registry scripts before installation:
no preinstall/install/postinstall hooks. Installed with --ignore-scripts;
inspected the installed manifest, MIT license, createClient export and session
configuration, and the upstream source/history and official API documentation.
No upstream code was copied or modified. The npm dependency retains its license.

Exact surfaces used: createClient; auth.getSession/getUser/onAuthStateChange;
signInWithPassword/signUp/signOut/resetPasswordForEmail/updateUser; table
select/insert/update with owner filters. No realtime/storage/admin SDK features.
Auth/storage stay outside simulation/analytics/domain contracts. Library updates
and Supabase's hosted service remain maintenance dependencies. Upstream test
suites were not run; local integration-facing tests and production compilation
passed. Online production-only npm audit reported zero production advisories;
installation reported seven moderate findings across the full dev-inclusive
installation. No unrelated dependency upgrades were applied.

Fallback: existing guest workspace continues to work without configuring cloud
accounts. No browser-only account or fake persistent cloud store is substituted.

Official references:
- https://supabase.com/docs/reference/javascript/auth-signinwithpassword
- https://supabase.com/docs/reference/javascript/auth-signup
- https://supabase.com/docs/reference/javascript/auth-getuser
- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://supabase.com/docs/guides/auth/redirect-urls
- https://github.com/supabase/supabase-js/blob/master/LICENSE
