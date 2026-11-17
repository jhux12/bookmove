# Development and validation

Use the existing checkout; no extra Git worktree is needed for cloud tasks.

- Node 24 and Bun 1.4.4 are validated. Install dependencies with `bun install --frozen-lockfile`.
- `npm run dev` starts Vite on port 3000.
- `npm run lint` checks TypeScript.
- `npm test` replays all curriculum lines and tests depth scope, session validation, and guest/cloud progress merging.
- `npm run test:browser` tests the mobile layout, keyboard chess moves, course depth persistence, completion dialog focus/overflow, game recovery/discard protection, and demo messaging. Install Chromium with Playwright when a system Chromium is unavailable. Set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to use another installed binary.
- `npm run build` creates the production bundle, including a separate bot worker and lazy route chunks.

## Firebase integration tests

These tests use a local demo project, not production data. Java 21 and Firebase CLI 15.15.0 are validated prerequisites. Run:

```sh
firebase emulators:exec --only firestore --project demo-bookmove --config firebase.test.json 'npm run test:rules'
```

The tests reject client paid-entitlement writes, allow a free profile and normal profile updates, and exercise idempotent import of guest progress, custom lines and games under the rules. In the cloud environment, place the emulator cache under `/workspace` using `FIREBASE_EMULATORS_PATH`. The first run needs the official Firestore emulator JAR from `storage.googleapis.com`; this task's network policy blocked that download (HTTP 403), so those integration tests have not yet run. TypeScript and the independent merge tests run without the emulator. Do not call the rules or live sync verified until integration tests complete.

The checked-in rules are not automatically deployed by a Git push. Apply and verify them in the project's actual Firebase deployment workflow before exposing paid access. This release intentionally has no checkout or payment API. Demo access is a separate local browser flag and never writes a user's subscription fields. Existing server-granted subscriptions are read from the account; future billing must use trusted server administration/webhooks to update them.

## Saved work and accounts

Unfinished bot games persist full PGN, opponent, orientation, assistance and clock values. Recovery is explicit and pauses clocks while away; this is casual bot play, not a competitive clock guarantee. New-game and resign actions require confirmation. Invalid or completed session payloads are ignored.

Guest-to-account imports use document IDs and transactions. More recent cloud reviews are retained; counters are not added twice on retries. Existing account lines and games are not overwritten by guest copies. Original guest data remains in this browser as a backup. Signed-in lesson reviews also have an account-scoped local pending queue; signing in again retries those reviews. Cloud errors are shown globally. Live Google OAuth and multi-device sync still require verification against an authorized Firebase environment.

## Performance

The coach avatar remains visible. Portraits are resized to 192px WebP (about 7–9KB each), replacing 660–750KB JPEGs. Secondary workspaces load lazily; bot move search runs in a Web Worker, with stale results ignored after ending or replacing a game. Account SDK initialization is deferred until after the guest UI renders. The initial application entry is about 131KB compressed (previously about 365KB); the account SDK is a separate background chunk of about 172KB compressed. These sizes are build outputs, not a measured time-to-interactive claim.
