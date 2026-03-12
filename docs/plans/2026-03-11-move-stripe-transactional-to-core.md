# Move Stripe & Transactional to Core Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Move `@packages/stripe` → `@core/stripe` and `@packages/transactional` → `@core/transactional` to enforce core-only dependencies in `core/authentication`, add vitest tests, and standardize tooling.

**Architecture:** Both packages are thin wrappers around external services (Stripe SDK, Resend) that only depend on `@core/*`. They belong in `core/` since `core/authentication` depends on them — and `core/` must never depend on `packages/`. After the move, all import paths change from `@packages/stripe` → `@core/stripe` and `@packages/transactional` → `@core/transactional`. Factory functions (`getStripeClient`, `getResendClient`) stay as-is — they already follow the core pattern (factory + injected config). Tests use vitest with mock factories (same pattern as `core/posthog`).

**Tech Stack:** Vitest, `vi.fn()` mocks, `vite-tsconfig-paths`, oxlint, oxfmt

---

### Dependency Map (all files that need import updates)

**`@packages/stripe` consumers:**

| File | Imports |
|---|---|
| `core/authentication/src/server.ts` | `getStripeClient` from `@packages/stripe` |
| `core/authentication/package.json` | `"@packages/stripe": "workspace:*"` |
| `apps/web/src/integrations/orpc/server-instances.ts` | `getStripeClient` from `@packages/stripe` |
| `apps/web/src/integrations/orpc/server.ts` | `type StripeClient` from `@packages/stripe` |
| `apps/web/src/hooks/use-has-addon.ts` | `AddonName` from `@packages/stripe/constants` |
| `apps/web/src/features/billing/ui/billing-overview.tsx` | `FREE_TIER_LIMITS` from `@packages/stripe/constants` |
| `apps/web/src/routes/.../access-control.tsx` | `AddonName` from `@packages/stripe/constants` |
| `apps/web/src/routes/.../activity-logs.tsx` | `AddonName` from `@packages/stripe/constants` |
| `apps/web/src/routes/.../authentication.tsx` | `AddonName` from `@packages/stripe/constants` |
| `apps/web/src/routes/.../roles.tsx` | `AddonName` from `@packages/stripe/constants` |
| `apps/web/package.json` | `"@packages/stripe": "workspace:*"` |
| `apps/server/package.json` | `"@packages/stripe": "workspace:*"` |
| `packages/events/src/emit.ts` | `type StripeClient` from `@packages/stripe`, `STRIPE_METER_EVENTS` from `@packages/stripe/constants` |
| `packages/events/src/reconcile.ts` | `FREE_TIER_LIMITS` from `@packages/stripe/constants` |
| `packages/events/src/credits.ts` | `FREE_TIER_LIMITS` from `@packages/stripe/constants` |
| `packages/events/package.json` | `"@packages/stripe": "workspace:*"` |
| `packages/arcjet/package.json` | `"@packages/stripe": "workspace:*"` |

**`@packages/transactional` consumers:**

| File | Imports |
|---|---|
| `core/authentication/src/server.ts` | `getResendClient`, `sendEmailOTP`, `sendMagicLinkEmail`, `sendOrganizationInvitation` from `@packages/transactional/client` |
| `core/authentication/package.json` | `"@packages/transactional": "workspace:*"` |
| `apps/worker/src/jobs/check-budget-alerts.ts` | `sendBudgetAlertEmail`, `getResendClient` from `@packages/transactional/client` |
| `apps/server/package.json` | `"@packages/transactional": "workspace:*"` |

---

### Task 1: Move Stripe to Core

**Files:**
- Move: `packages/stripe/` → `core/stripe/`
- Modify: `core/stripe/package.json`
- Create: `core/stripe/oxlint.json`
- Create: `core/stripe/vitest.config.ts`
- Create: `core/stripe/tsconfig.test.json`

**Step 1: Move the directory**

```bash
mv packages/stripe core/stripe
```

**Step 2: Update `core/stripe/package.json`**

Change the package name and add missing scripts:

```json
{
   "name": "@core/stripe",
   "version": "0.3.0",
   "private": true,
   "license": "Apache-2.0",
   "files": [
      "dist"
   ],
   "type": "module",
   "exports": {
      ".": {
         "types": "./dist/src/index.d.ts",
         "default": "./src/index.ts"
      },
      "./constants": {
         "types": "./dist/src/constants.d.ts",
         "default": "./src/constants.ts"
      }
   },
   "scripts": {
      "build": "tsc --build",
      "check": "oxlint ./src",
      "format": "oxfmt --write ./src",
      "format:check": "oxfmt --check ./src",
      "test": "vitest run --passWithNoTests",
      "typecheck": "tsgo"
   },
   "dependencies": {
      "@core/environment": "workspace:*",
      "@core/logging": "workspace:*",
      "stripe": "catalog:payments"
   },
   "devDependencies": {
      "@tooling/typescript": "workspace:*",
      "typescript": "catalog:development"
   }
}
```

**Step 3: Create `core/stripe/oxlint.json`**

```json
{
   "$schema": "../../node_modules/oxlint/configuration_schema.json",
   "extends": ["../../tooling/oxc/core.json"]
}
```

**Step 4: Create `core/stripe/vitest.config.ts`**

```typescript
import viteTsConfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
   plugins: [
      viteTsConfigPaths({
         projects: ["./tsconfig.test.json"],
      }),
   ],
   test: {
      include: ["./__tests__/**/*.test.ts"],
   },
});
```

**Step 5: Create `core/stripe/tsconfig.test.json`**

```json
{
   "extends": "./tsconfig.json",
   "compilerOptions": {
      "types": ["vitest/globals"]
   },
   "include": ["src", "__tests__"]
}
```

**Step 6: Commit**

```bash
git add core/stripe packages/stripe
git commit -m "refactor(stripe): move @packages/stripe to @core/stripe"
```

---

### Task 2: Move Transactional to Core

**Files:**
- Move: `packages/transactional/` → `core/transactional/`
- Modify: `core/transactional/package.json`
- Create: `core/transactional/oxlint.json`
- Create: `core/transactional/vitest.config.ts`
- Create: `core/transactional/tsconfig.test.json`

**Step 1: Move the directory**

```bash
mv packages/transactional core/transactional
```

**Step 2: Update `core/transactional/package.json`**

```json
{
   "name": "@core/transactional",
   "version": "0.8.1",
   "private": true,
   "license": "Apache-2.0",
   "files": [
      "dist"
   ],
   "type": "module",
   "exports": {
      "./client": {
         "types": "./dist/src/client.d.ts",
         "default": "./src/client.tsx"
      },
      "./utils": {
         "types": "./dist/src/utils.d.ts",
         "default": "./src/utils.ts"
      }
   },
   "scripts": {
      "build": "tsc --build",
      "check": "oxlint ./src",
      "format": "oxfmt --write ./src",
      "format:check": "oxfmt --check ./src",
      "test": "vitest run --passWithNoTests",
      "typecheck": "tsgo"
   },
   "dependencies": {
      "@core/logging": "workspace:*",
      "@core/utils": "workspace:*",
      "@react-email/components": "catalog:transactional",
      "react": "catalog:react",
      "react-dom": "catalog:react",
      "resend": "catalog:transactional"
   },
   "devDependencies": {
      "@tooling/typescript": "workspace:*",
      "@types/react": "catalog:react",
      "@types/react-dom": "catalog:react",
      "react-email": "catalog:transactional",
      "typescript": "catalog:development"
   }
}
```

**Step 3: Create `core/transactional/oxlint.json`**

```json
{
   "$schema": "../../node_modules/oxlint/configuration_schema.json",
   "extends": ["../../tooling/oxc/core.json"]
}
```

**Step 4: Create `core/transactional/vitest.config.ts`**

```typescript
import viteTsConfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
   plugins: [
      viteTsConfigPaths({
         projects: ["./tsconfig.test.json"],
      }),
   ],
   test: {
      include: ["./__tests__/**/*.test.ts"],
   },
});
```

**Step 5: Create `core/transactional/tsconfig.test.json`**

```json
{
   "extends": "./tsconfig.json",
   "compilerOptions": {
      "types": ["vitest/globals"]
   },
   "include": ["src", "__tests__"]
}
```

**Step 6: Commit**

```bash
git add core/transactional packages/transactional
git commit -m "refactor(transactional): move @packages/transactional to @core/transactional"
```

---

### Task 3: Update All Stripe Imports

**Files to modify (source imports):**
- `core/authentication/src/server.ts` — `@packages/stripe` → `@core/stripe`
- `apps/web/src/integrations/orpc/server-instances.ts` — `@packages/stripe` → `@core/stripe`
- `apps/web/src/integrations/orpc/server.ts` — `@packages/stripe` → `@core/stripe`
- `apps/web/src/hooks/use-has-addon.ts` — `@packages/stripe/constants` → `@core/stripe/constants`
- `apps/web/src/features/billing/ui/billing-overview.tsx` — `@packages/stripe/constants` → `@core/stripe/constants`
- `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/settings/project/access-control.tsx` — `@packages/stripe/constants` → `@core/stripe/constants`
- `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/settings/project/activity-logs.tsx` — `@packages/stripe/constants` → `@core/stripe/constants`
- `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/settings/organization/authentication.tsx` — `@packages/stripe/constants` → `@core/stripe/constants`
- `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/settings/organization/roles.tsx` — `@packages/stripe/constants` → `@core/stripe/constants`
- `packages/events/src/emit.ts` — `@packages/stripe` → `@core/stripe`, `@packages/stripe/constants` → `@core/stripe/constants`
- `packages/events/src/reconcile.ts` — `@packages/stripe/constants` → `@core/stripe/constants`
- `packages/events/src/credits.ts` — `@packages/stripe/constants` → `@core/stripe/constants`

**Files to modify (package.json dependencies):**
- `core/authentication/package.json` — `"@packages/stripe"` → `"@core/stripe"`
- `apps/web/package.json` — `"@packages/stripe"` → `"@core/stripe"`
- `apps/server/package.json` — `"@packages/stripe"` → `"@core/stripe"`
- `packages/events/package.json` — `"@packages/stripe"` → `"@core/stripe"`
- `packages/arcjet/package.json` — `"@packages/stripe"` → `"@core/stripe"`

**Step 1: Run find-and-replace across all source files**

In every file listed above, replace:
- `from "@packages/stripe/constants"` → `from "@core/stripe/constants"`
- `from "@packages/stripe"` → `from "@core/stripe"`

**Step 2: Update package.json dependencies**

In every package.json listed above, replace:
- `"@packages/stripe": "workspace:*"` → `"@core/stripe": "workspace:*"`

**Step 3: Run typecheck to verify**

```bash
bun run typecheck
```

**Step 4: Commit**

```bash
git add -A
git commit -m "refactor(stripe): update all imports from @packages/stripe to @core/stripe"
```

---

### Task 4: Update All Transactional Imports

**Files to modify (source imports):**
- `core/authentication/src/server.ts` — `@packages/transactional/client` → `@core/transactional/client`
- `apps/worker/src/jobs/check-budget-alerts.ts` — `@packages/transactional/client` → `@core/transactional/client`

**Files to modify (package.json dependencies):**
- `core/authentication/package.json` — `"@packages/transactional"` → `"@core/transactional"`
- `apps/server/package.json` — `"@packages/transactional"` → `"@core/transactional"`

**Step 1: Run find-and-replace across all source files**

In every file listed above, replace:
- `from "@packages/transactional/client"` → `from "@core/transactional/client"`

**Step 2: Update package.json dependencies**

In every package.json listed above, replace:
- `"@packages/transactional": "workspace:*"` → `"@core/transactional": "workspace:*"`

**Step 3: Run typecheck to verify**

```bash
bun run typecheck
```

**Step 4: Commit**

```bash
git add -A
git commit -m "refactor(transactional): update all imports from @packages/transactional to @core/transactional"
```

---

### Task 5: Add Stripe Tests

**Files:**
- Create: `core/stripe/__tests__/helpers/create-mock-stripe.ts`
- Create: `core/stripe/__tests__/index.test.ts`
- Create: `core/stripe/__tests__/constants.test.ts`

**Step 1: Create the mock factory**

`core/stripe/__tests__/helpers/create-mock-stripe.ts`

```typescript
import { vi } from "vitest";
import type Stripe from "stripe";

export function createMockStripe() {
   return {
      billing: {
         meterEvents: {
            create: vi.fn().mockResolvedValue({ identifier: "evt_123" }),
         },
      },
      customers: {
         create: vi.fn().mockResolvedValue({ id: "cus_123" }),
      },
      subscriptions: {
         list: vi.fn().mockResolvedValue({ data: [] }),
      },
   } as unknown as Stripe & {
      billing: {
         meterEvents: {
            create: ReturnType<typeof vi.fn>;
         };
      };
      customers: {
         create: ReturnType<typeof vi.fn>;
      };
      subscriptions: {
         list: ReturnType<typeof vi.fn>;
      };
   };
}
```

**Step 2: Write the failing test for `getStripeClient`**

`core/stripe/__tests__/index.test.ts`

```typescript
import { describe, expect, it, vi } from "vitest";

vi.mock("stripe", () => {
   const MockStripe = vi.fn().mockImplementation(() => ({
      billing: { meterEvents: { create: vi.fn() } },
   }));
   return { default: MockStripe };
});

import { getStripeClient } from "../src/index";

describe("getStripeClient", () => {
   it("creates a Stripe instance with the provided key", () => {
      const client = getStripeClient("sk_test_123");
      expect(client).toBeDefined();
   });

   it("throws when key is missing", () => {
      expect(() => getStripeClient("" as any)).toThrow(
         "Stripe key is required",
      );
   });
});
```

**Step 3: Write the constants test**

`core/stripe/__tests__/constants.test.ts`

```typescript
import { describe, expect, it } from "vitest";
import {
   AddonName,
   EVENT_PRICES,
   FREE_TIER_LIMITS,
   STRIPE_METER_EVENTS,
} from "../src/constants";

describe("AddonName", () => {
   it("has expected values", () => {
      expect(AddonName.BOOST).toBe("boost");
      expect(AddonName.SCALE).toBe("scale");
      expect(AddonName.ENTERPRISE).toBe("enterprise");
   });
});

describe("FREE_TIER_LIMITS", () => {
   it("has positive integer limits for all events", () => {
      for (const [key, value] of Object.entries(FREE_TIER_LIMITS)) {
         expect(value, `${key} should be positive`).toBeGreaterThan(0);
         expect(Number.isInteger(value), `${key} should be integer`).toBe(
            true,
         );
      }
   });
});

describe("EVENT_PRICES", () => {
   it("has string prices with 6 decimal places for all events", () => {
      for (const [key, value] of Object.entries(EVENT_PRICES)) {
         expect(value, `${key} should match N.NNNNNN`).toMatch(
            /^\d+\.\d{6}$/,
         );
      }
   });

   it("covers all FREE_TIER_LIMITS events", () => {
      for (const key of Object.keys(FREE_TIER_LIMITS)) {
         expect(
            EVENT_PRICES[key],
            `${key} missing from EVENT_PRICES`,
         ).toBeDefined();
      }
   });
});

describe("STRIPE_METER_EVENTS", () => {
   it("covers all FREE_TIER_LIMITS events", () => {
      for (const key of Object.keys(FREE_TIER_LIMITS)) {
         expect(
            STRIPE_METER_EVENTS[key],
            `${key} missing from STRIPE_METER_EVENTS`,
         ).toBeDefined();
      }
   });

   it("has non-empty string values", () => {
      for (const [key, value] of Object.entries(STRIPE_METER_EVENTS)) {
         expect(value, `${key} should be non-empty`).toBeTruthy();
      }
   });
});
```

**Step 4: Run tests**

```bash
cd core/stripe && npx vitest run
```

Expected: All pass.

**Step 5: Commit**

```bash
git add core/stripe/__tests__
git commit -m "test(stripe): add vitest tests for client factory and constants"
```

---

### Task 6: Add Transactional Tests

**Files:**
- Create: `core/transactional/__tests__/helpers/create-mock-resend.ts`
- Create: `core/transactional/__tests__/utils.test.ts`
- Create: `core/transactional/__tests__/client.test.ts`

**Step 1: Create the mock factory**

`core/transactional/__tests__/helpers/create-mock-resend.ts`

```typescript
import { vi } from "vitest";
import type { Resend } from "resend";

export function createMockResend() {
   return {
      emails: {
         send: vi.fn().mockResolvedValue({ data: { id: "email_123" } }),
      },
   } as unknown as Resend & {
      emails: {
         send: ReturnType<typeof vi.fn>;
      };
   };
}
```

**Step 2: Write `getResendClient` test**

`core/transactional/__tests__/utils.test.ts`

```typescript
import { describe, expect, it, vi } from "vitest";

vi.mock("resend", () => {
   const MockResend = vi.fn().mockImplementation(() => ({
      emails: { send: vi.fn() },
   }));
   return { Resend: MockResend };
});

import { getResendClient } from "../src/utils";

describe("getResendClient", () => {
   it("creates a Resend instance with the provided key", () => {
      const client = getResendClient("re_test_123");
      expect(client).toBeDefined();
   });

   it("throws when key is missing", () => {
      expect(() => getResendClient("" as any)).toThrow(
         "RESEND_API_KEY is required",
      );
   });
});
```

**Step 3: Write email sending tests**

`core/transactional/__tests__/client.test.ts`

```typescript
import { describe, expect, it } from "vitest";
import { createMockResend } from "./helpers/create-mock-resend";
import {
   sendBudgetAlertEmail,
   sendEmailOTP,
   sendMagicLinkEmail,
   sendOrganizationInvitation,
} from "../src/client";

describe("sendOrganizationInvitation", () => {
   it("sends email with correct subject and recipient", async () => {
      const client = createMockResend();
      await sendOrganizationInvitation(client, {
         email: "test@example.com",
         invitedByUsername: "John",
         invitedByEmail: "john@example.com",
         teamName: "Acme",
         inviteLink: "https://app.montte.co/invite/123",
      });

      expect(client.emails.send).toHaveBeenCalledWith(
         expect.objectContaining({
            to: "test@example.com",
            subject: "Convite para se juntar à equipe Acme no Montte",
            from: "Montte <suporte@mail.montte.co>",
         }),
      );
   });
});

describe("sendEmailOTP", () => {
   it("sends sign-in OTP with correct subject", async () => {
      const client = createMockResend();
      await sendEmailOTP(client, {
         email: "test@example.com",
         otp: "123456",
         type: "sign-in",
      });

      expect(client.emails.send).toHaveBeenCalledWith(
         expect.objectContaining({
            to: "test@example.com",
            subject: "Faça login na sua conta",
         }),
      );
   });

   it("sends email-verification OTP with correct subject", async () => {
      const client = createMockResend();
      await sendEmailOTP(client, {
         email: "test@example.com",
         otp: "654321",
         type: "email-verification",
      });

      expect(client.emails.send).toHaveBeenCalledWith(
         expect.objectContaining({
            subject: "Verifique seu e-mail",
         }),
      );
   });

   it("sends forget-password OTP with correct subject", async () => {
      const client = createMockResend();
      await sendEmailOTP(client, {
         email: "test@example.com",
         otp: "111111",
         type: "forget-password",
      });

      expect(client.emails.send).toHaveBeenCalledWith(
         expect.objectContaining({
            subject: "Redefina sua senha",
         }),
      );
   });
});

describe("sendMagicLinkEmail", () => {
   it("sends email with correct subject and recipient", async () => {
      const client = createMockResend();
      await sendMagicLinkEmail(client, {
         email: "test@example.com",
         magicLinkUrl: "https://app.montte.co/magic/abc",
      });

      expect(client.emails.send).toHaveBeenCalledWith(
         expect.objectContaining({
            to: "test@example.com",
            subject: "Acesse sua conta Montte",
            from: "Montte <suporte@mail.montte.co>",
         }),
      );
   });
});

describe("sendBudgetAlertEmail", () => {
   it("sends email with category and percentage in subject", async () => {
      const client = createMockResend();
      await sendBudgetAlertEmail(client, {
         email: "test@example.com",
         categoryName: "Marketing",
         spentAmount: "R$ 800,00",
         limitAmount: "R$ 1.000,00",
         percentUsed: 80,
         alertThreshold: 75,
         month: "março",
      });

      expect(client.emails.send).toHaveBeenCalledWith(
         expect.objectContaining({
            to: "test@example.com",
            subject: "Alerta de meta: Marketing atingiu 80% do limite",
            from: "Montte <suporte@mail.montte.co>",
         }),
      );
   });
});
```

**Step 4: Run tests**

```bash
cd core/transactional && npx vitest run
```

Expected: All pass.

**Step 5: Commit**

```bash
git add core/transactional/__tests__
git commit -m "test(transactional): add vitest tests for client factory and email senders"
```

---

### Task 7: Run `bun install` and Full Verification

**Step 1: Install dependencies (lockfile update)**

```bash
bun install
```

**Step 2: Run linting on new core packages**

```bash
cd core/stripe && bun run check && bun run format:check
cd core/transactional && bun run check && bun run format:check
```

**Step 3: Run full typecheck**

```bash
bun run typecheck
```

**Step 4: Run all tests**

```bash
bun run test
```

**Step 5: Commit lockfile if changed**

```bash
git add bun.lock
git commit -m "chore: update lockfile after stripe/transactional move to core"
```

---

### Task 8: Clean Up Old Package Directories

**Step 1: Verify old directories are gone**

After `mv`, the old directories should no longer exist. If git still tracks them:

```bash
git rm -r packages/stripe packages/transactional --cached 2>/dev/null || true
```

**Step 2: Remove old README if exists**

```bash
rm -f core/stripe/README.md
```

**Step 3: Final commit if needed**

```bash
git add -A
git commit -m "chore: clean up old packages/stripe and packages/transactional"
```
