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

● Runtime and versions: discover from repository configuration.

● Package manager: discover from lockfiles and configuration.

● Install command: discover from project documentation.

● Test command: discover from scripts or project documentation.

● Lint command: discover from scripts or project documentation.

● Type-check command: discover from scripts or project documentation.

● Build command: discover from scripts or project documentation.

● Start command: discover from scripts or project documentation.

● Architecture notes: document confirmed project-specific constraints here.