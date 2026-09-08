Repository Agent Instructions

Mission

● Work toward the user’s stated goal while preserving existing behavior outside the requested scope.

● Ground conclusions in repository contents, command output, tests, or other concrete evidence.

● Prefer the smallest complete change that satisfies the acceptance criteria.

Before Making Changes

● Read this file, the root README, relevant package manifests, and documentation for the affected area.

● Inspect the current implementation, nearby tests, and repository conventions before proposing a solution.

● Check the working tree and preserve all unrelated user changes.

● Identify the relevant build, test, lint, formatting, and type-check commands from repository configuration. Do not guess commands when they can be discovered.

● If the request is ambiguous in a way that materially changes behavior, scope, data, security, or architecture, ask before editing.

Working Method

1. Reproduce or establish the current behavior when practical.

2. Form a short implementation plan for non-trivial work.

3. Make focused, reviewable changes.

4. Add or update tests for changed behavior, especially regression tests for bug fixes.

5. Run the narrowest relevant checks first, then broader checks when warranted.

6. Inspect the final diff for accidental or unrelated changes.

7. Report what changed, what was verified, and any remaining risks or unverified assumptions.

Change Boundaries

● Do not modify files unrelated to the task.

● Do not rewrite or reformat large areas unless required by the request.

● Do not weaken tests, validation, types, authorization, or security controls merely to make checks pass.

● Do not change public APIs, persisted data formats, or externally observable behavior unless explicitly required.

● Do not introduce new production dependencies without approval. Prefer existing libraries and platform capabilities.

● Do not update lockfiles unless dependency changes are required and authorized.

● Do not alter generated files manually when a documented generator exists.

● Do not overwrite or remove existing user changes.

Safety and External Effects

● Never expose, print, copy, or commit secrets, credentials, tokens, personal data, or environment-file contents.

● Do not access production systems or real customer data.

● Do not deploy, publish, release, merge, push, create commits, rotate credentials, run destructive migrations, or perform external writes unless the user explicitly requests that action.

● Ask before running commands that may delete data, modify infrastructure, incur material cost, or affect systems outside the local development environment.

● Prefer dry runs, sandboxes, fixtures, mocks, and local test environments.

Validation

● Use the repository’s documented commands rather than inventing alternatives.

● For code changes, run the relevant tests plus applicable lint, formatting, type-check, and build checks.

● If a check cannot be run, explain exactly why; do not claim success without evidence.

● Distinguish pre-existing failures from failures introduced by the change.

● For bug fixes, demonstrate that a regression test fails before the fix when practical and passes afterward.

● For behavior changes, test expected behavior, important edge cases, and relevant failure paths.

Code Review Rules

● Prioritize actionable issues affecting correctness, security, reliability, performance, maintainability, or developer experience.

● Report only findings supported by concrete evidence.

● Include the affected file and precise location whenever possible.

● Explain the triggering conditions, impact, and a safe remediation path.

● Distinguish confirmed defects from risks or suggestions.

● Avoid cosmetic or preference-only comments unless they violate an explicit repository convention or obscure correctness.

Communication

● Lead with the result or most important finding.

● Keep progress updates concise and surface blockers early.

● State assumptions explicitly.

● At completion, summarize:

● files and behavior changed;

● validation commands and outcomes;

● remaining risks, limitations, or follow-up work.

Repository-Specific Configuration

Maintain this section as the project evolves:

● Runtime and versions: Node 24.20.0 (see `.node-version`). No TypeScript anywhere in the repo (no `tsconfig.json`) - client and server are plain JS/Vue.

● Package manager: npm, with three separate `package.json`/`package-lock.json` (root, `client/`, `server/`). Root `package.json` has no `dependencies`, only `devDependencies` (eslint, prettier, nodemon, concurrently) and orchestration scripts that `cd` into `client/`/`server/`.

● Install command: `npm install` in each of the three locations separately (root, `client/`, `server/`) - there is no workspaces/monorepo tooling tying them together.

● Test command:
  - Both at once (from repo root): `npm test` (runs server tests, then client tests).
  - Server only: `cd server && npm test` → `node --test utils/__tests__/*.test.js` (Node's built-in test runner, no Jest/Mocha). New server tests must live in `utils/__tests__/` or be added to this glob, or they will silently not run.
  - Do NOT add a second glob segment (e.g. `middleware/__tests__/*.test.js`) for a directory that currently has no `.test.js` files in it - Node's test runner CLI errors out with "Could not find '<path>'" if a glob segment matches zero files (confirmed: passed locally under bash, failed on GitHub Actions' shell - do not assume "works locally" is enough proof here). If middleware tests are reintroduced later, add the segment back once at least one matching file exists, and verify in CI, not just locally.
  - Do NOT use bare `node --test` (no path args) as a "just discover everything" shortcut either - tried once during this project's setup and it recursively picked up unrelated files and hung indefinitely (over 120s, had to be killed). Stick to explicit `<dir>/__tests__/*.test.js` globs per directory that actually contains tests.
  - Client only: `cd client && npm test` → `vitest run` (Vitest). Client tests live in `client/src/**/__tests__/*.test.js`.
  - Client test caveat: IndexedDB (Dexie) is not available in the Vitest/jsdom environment - `offlineStorage.js`-dependent code logs a `DexieError [MissingAPIError]` during test runs; this is expected noise, not a failure, as long as the test still reports pass.

● Lint command: `npm run lint` (root) → `eslint .` using the flat config in `eslint.config.js`, which has separate rule blocks per area (`client/src/**/*.{js,vue}`, `server/**/*.js`, plus several narrower blocks for build/scripts/config files). `npm run lint:fix` for autofix. `npm run format` runs Prettier (`.prettierrc`: `singleQuote: false` means double quotes are the enforced style, 100 print width, semicolons on).

● Type-check command: none - no TypeScript, no type-checking step exists or is needed.

● Build command:
  - Client (the only thing that gets "built" in the traditional sense): `npm run build` (root) or `cd client && npm run build` → runs `clean:dist` then `vite build`, output in `client/dist/`.
  - Server has no build step; it runs directly via Node (`server/server.js`).
  - iOS native build is a separate, manual step outside this repo's automated tooling - see Architecture notes.

● Start command:
  - Server dev: `npm run server` (root, nodemon) or `npm run start:server` (root, plain node) - both `cd server` first.
  - Client dev: `npm run client` (root) or `cd client && npm run dev` (Vite dev server).
  - Both together: `npm run dev` (root) → runs `./dev-stable.sh`.

● Architecture notes:
  - Three-part system: `client/` (Vue 3 + Capacitor 7 iOS app, Pinia, vue-router, vue-i18n with DE/EN dual-locale objects in `client/src/i18n/index.js`), `server/` (Node/Express 5 + MongoDB/Mongoose, deployed to Render.com per `render.yaml`), and the native iOS project at `client/ios/App/` (git-tracked except `Pods/`, `build/`, and the synced web `public/` folder - see `.gitignore`).
  - Client-side changes are NOT visible in the iOS app until the native project is rebuilt: `npm run build` (client) → `npx cap sync ios` (or `npm run cap:sync` in `client/`) → rebuild in Xcode. Server-side changes take effect after Render redeploys; no local rebuild step needed for those.
  - Xcode scheme gotcha: `client/ios/App/App.xcodeproj/xcshareddata/xcschemes/App.xcscheme` has separate `buildConfiguration` values per action (`LaunchAction` = Debug for local dev/Safari Web Inspector debugging, `ArchiveAction` = Release for App Store submission). Do not "fix" one by copying the other's value - they serve different purposes and were previously a source of confusion (Safari Web Inspector showing an empty/no-content device when `LaunchAction` was accidentally set to Release, since Capacitor's `isInspectable` is gated behind the `DEBUG` compile flag).
  - Auth is Firebase (email/password + Google + Apple, native + web flows differ). Server enforces email verification server-side in `server/middleware/firebaseAuth.js` independent of client-side checks in `client/src/stores/authStore.js` - federated providers (Google/Apple) are treated as implicitly verified even when Firebase's `emailVerified` flag is unreliable for them (see `isEffectivelyEmailVerified()` client-side / `isEmailVerifiedFromToken()` server-side, and their matching test files).
  - Offline-first data layer: client persists workouts in IndexedDB via Dexie (`client/src/utils/offlineStorage.js`) with a separate sync queue processed by `client/src/utils/syncManager.js` (retry/backoff, tombstones for deletes and discarded drafts). Favorites (`client/src/utils/workoutFavorites.js`) use a much simpler `localStorage`-only + fire-and-forget server sync, deliberately less robust than the workout sync path - be aware of this asymmetry when touching either.
  - AI feedback pipeline (`server/routes/workouts.js` `POST /:id/ai-analysis`, `server/services/OpenAIProvider.js`/`OllamaProvider.js`) has several env-var-configurable thresholds currently set to test-phase values, not production defaults - check current values in Render's environment before assuming production behavior: `AI_FEEDBACK_MIN_REPETITIONS`, `AI_FEEDBACK_MIN_HISTORY_DAYS` (comparison-feedback trigger), `WORKOUT_EDIT_WINDOW_HOURS` (default 24 - how long a completed workout stays editable via `PUT /:id`, anchored on the `completedAt` field which is set once and never re-touched on subsequent saves), `AI_BURST_LIMIT_*` (in-memory, not persistent across restarts/instances).
  - See `TESTPHASE-TESTMATRIX.md` (repo root) for a fuller map of critical user flows, known gaps, and existing test coverage per flow - useful starting context before touching auth, workout save/sync, or AI feedback code.