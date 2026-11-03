# Workspace access implementation contract

The original finance owner is the sole administrator. Every authenticated user owns a
private workspace. A shared workspace is absent until the administrator creates
explicit per-page grants. No grants are installed by the schema migration.

## Secure workspace selection

1. Sign in and fetch a directory of the user's own workspace plus only workspaces
   for which grants exist. Display human-readable email/name and an **Own data**
   or **Shared data** badge.
2. On workspace selection, verify the grant on the server before changing data.
   Scope the browser cache by both the signed-in user ID and workspace owner ID.
   Never preload a shared owner's full cached dataset.
3. A shared workspace must load its authorized sections from the cloud before
   controls unlock. A failed load cannot promote local data to the owner's cloud.
4. Recheck grants on resume and before every write. When a grant is revoked,
   lock the workspace, remove its cached data, and return to the user's own
   workspace. Existing protected sync rules for the owner's own workspace stay intact.

## Data and page access

The page matrix is saved in `finance_page_access` for each user's own workspace
and `finance_workspace_grants` for explicit shares. `off`, `view`, and `edit`
must be enforced by database RLS and by the UI. Merely hiding navigation is
insufficient. Shared edits write records under the owner's `user_id`, with the
current authenticated user recorded as `updated_by`.

The existing local-first sync currently constructs all finance sections as one
snapshot. Before enabling any grants:

- Map every sync section to the pages that need it. Some pages (Dashboard and
  Reports) aggregate several sections, so permission-dependent totals must omit
  inaccessible sections.
- Fetch only authorized sections. Never send hidden sections to a shared browser.
- Filter sync upserts, deletes, recovery, backups, and reconciliation by edit
  permission; prevent default/empty objects from being written over the owner's
  existing records.
- Disable all mutations in view-only mode, including add, edit, delete, import,
  payments, bulk actions, and indirect actions from dashboard cards. Preserve
  sorting, filters, navigation, and exports only where explicitly permitted.
- Build navigation from allowed pages, and route-guard direct `nav(page)` calls.
  CSS flex/grid must close gaps when a tab is removed, including mobile menus.

## Audit and account

`finance_record_audit` records the actor, owner workspace, section, record ID,
action, and before/after data on committed cloud writes. A user reads the history
of their own workspace; the administrator reads every workspace. An ordinary
shared viewer does not inherit another user's audit history. Account displays
"Shared with" grants for the user's own workspace. Audit entries with no actor
are marked system/legacy sync.

## Release gate

Use separate test accounts and roll back test writes. Verify:

1. No grants: no other person's rows, account details, audit, or cached records.
2. Page view: authorized records visible; insert/update/delete and indirect
   mutation blocked by RLS, even when called directly through the Data API.
3. Page edit: only allowed sections writable; audit attributes the correct actor.
4. Page off: no rows fetched, navigation gap closed, direct route rejected.
5. Switch Own → Shared → Own repeatedly on the same device and another device;
   no records cross workspaces or reappear after a deletion.
6. Revocation while a shared workspace is open locks the view and clears its
   local cache. Offline mode must not show revoked cached data.
7. Verify reports, dashboard totals, imports, investments, assets, rental,
   statements, outgoings, backups, and sync conflict resolution under partial
   permissions before enabling production grants.

Email/password recovery should use a distinct reset screen at the approved
redirect route. Production SMTP must be configured before relying on sign-up
verification or recovery links.
