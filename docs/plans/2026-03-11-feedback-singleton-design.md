# Feedback Singleton Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Migrate `@packages/feedback` from a per-request factory to a package-level singleton that reads env-backed integrations directly and is covered by Vitest tests.

**Architecture:** Export a single `feedbackSender` instance from `packages/feedback/src/sender.ts`. The singleton will compose env-backed adapters once at module load time, while per-request values such as `userId` will move into the `send` call input. The router will stop constructing a sender and will call the singleton directly.

**Tech Stack:** TypeScript, Vitest, Vite, workspace path aliases, Octokit, PostHog singleton, fetch mocks.

---

### Task 1: Add package-level Vitest support

**Files:**
- Create: `packages/feedback/vitest.config.ts`
- Create: `packages/feedback/tsconfig.test.json`
- Modify: `packages/feedback/package.json`

**Step 1: Write the failing test**

Create a minimal test file import for `packages/feedback/src/sender.ts` under `packages/feedback/__tests__/sender.test.ts`.

**Step 2: Run test to verify it fails**

Run: `bunx vitest run packages/feedback/__tests__/sender.test.ts`
Expected: FAIL because the package has no Vitest config or test script yet.

**Step 3: Write minimal implementation**

Add `vitest.config.ts`, `tsconfig.test.json`, and a `test` script mirroring package patterns already used in `packages/events` and `packages/analytics`.

**Step 4: Run test to verify it passes loading stage**

Run: `bunx vitest run packages/feedback/__tests__/sender.test.ts`
Expected: Vitest starts and evaluates the test file.

### Task 2: Define singleton sender API with TDD

**Files:**
- Create: `packages/feedback/__tests__/sender.test.ts`
- Modify: `packages/feedback/src/sender.ts`
- Modify: `packages/feedback/src/schemas.ts`

**Step 1: Write the failing test**

Add tests that import `feedbackSender` and assert:
- env-backed adapters are created once at module load time
- `send({ userId, payload })` forwards to enabled adapters
- rejected adapters are logged without rejecting the whole send
- PostHog events are skipped when no `userId` is provided for payloads that need analytics context, or the API requires `userId`

**Step 2: Run test to verify it fails**

Run: `bunx vitest run packages/feedback/__tests__/sender.test.ts`
Expected: FAIL because `feedbackSender` and the new send input shape do not exist yet.

**Step 3: Write minimal implementation**

Refactor sender to:
- export `feedbackSender`
- build adapters once using env
- use direct singleton dependencies for GitHub and Discord
- accept a send input object carrying `userId` and `payload`

**Step 4: Run test to verify it passes**

Run: `bunx vitest run packages/feedback/__tests__/sender.test.ts`
Expected: PASS.

### Task 3: Keep adapters compatible with singleton design

**Files:**
- Modify: `packages/feedback/src/adapters/posthog.ts`
- Modify: `packages/feedback/src/adapters/github.ts`
- Modify: `packages/feedback/src/adapters/discord.ts`

**Step 1: Write the failing test**

Extend adapter assertions in `packages/feedback/__tests__/sender.test.ts` to verify:
- GitHub issue creation receives owner/repo from env-backed singleton wiring
- Discord fetch is called with webhook URL from env-backed singleton wiring
- PostHog capture uses the provided `userId`

**Step 2: Run test to verify it fails**

Run: `bunx vitest run packages/feedback/__tests__/sender.test.ts`
Expected: FAIL on mismatched adapter input shapes.

**Step 3: Write minimal implementation**

Update adapter contracts only as much as needed to support the singleton sender API.

**Step 4: Run test to verify it passes**

Run: `bunx vitest run packages/feedback/__tests__/sender.test.ts`
Expected: PASS.

### Task 4: Migrate feedback router to singleton usage

**Files:**
- Modify: `apps/web/src/integrations/orpc/router/feedback.ts`

**Step 1: Write the failing test**

If there is router coverage for feedback, add or update it to import the singleton API; otherwise use TypeScript verification as the safety net for the call-site migration.

**Step 2: Run test to verify it fails**

Run: `bun run typecheck`
Expected: FAIL because the router still imports `createFeedbackSender`.

**Step 3: Write minimal implementation**

Replace factory creation with `feedbackSender.send({ userId: context.userId, payload: { ... } })`.

**Step 4: Run test to verify it passes**

Run: `bun run typecheck`
Expected: PASS for the router call site.

### Task 5: Verify package and workspace impact

**Files:**
- Modify only files touched above

**Step 1: Run targeted tests**

Run: `bun run --filter @packages/feedback test`
Expected: PASS.

**Step 2: Run targeted typecheck**

Run: `bun run --filter @packages/feedback typecheck`
Expected: PASS.

**Step 3: Run workspace-level safety check**

Run: `bun run typecheck`
Expected: PASS.
