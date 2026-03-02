# Onboarding Server-Side Workspace Creation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the client-side workspace creation flow with a single oRPC procedure that uses Better Auth's server-only `auth.api.addMember` to add the user directly as an organization member + team member.

**Architecture:** A new `createWorkspace` procedure is added to the onboarding oRPC router, using `authenticatedProcedure` (no active org needed). It calls `auth.api.createOrganization`, `auth.api.createTeam`, `auth.api.addMember`, and `auth.api.addTeamMember` server-side, then provisions team resources. The client's `use-create-workspace.ts` becomes a thin wrapper that calls the oRPC procedure and follows up with client-side session state updates (`setActive` / `setActiveTeam`).

**Tech Stack:** oRPC (`authenticatedProcedure`), Better Auth server API (`auth.api.*`), React / TanStack transitions

---

## Task 1: Add `createWorkspace` procedure to onboarding router

**Files:**
- Modify: `apps/web/src/integrations/orpc/router/onboarding.ts`

**Step 1: Add `authenticatedProcedure` import**

Open `apps/web/src/integrations/orpc/router/onboarding.ts`. Change the import on line 15:

```typescript
import { authenticatedProcedure, protectedProcedure } from "../server";
```

**Step 2: Add `createSlug` import from utils**

Add to the imports at the top of the file:

```typescript
import { createSlug } from "@packages/utils/text";
```

**Step 3: Add the `createWorkspace` export at the bottom of the file**

```typescript
/**
 * Create a workspace (organization + team) server-side.
 * Uses auth.api.addMember to add the user directly without an invitation.
 * Uses authenticatedProcedure because there is no active org yet.
 */
export const createWorkspace = authenticatedProcedure
   .input(
      z.object({
         name: z.string().min(2).max(100),
         accountType: z.enum(["personal", "business"]).default("personal"),
      }),
   )
   .handler(async ({ context, input }) => {
      const { auth, headers, db, userId } = context;

      const slug = createSlug(input.name);

      // 1. Create organization
      const org = await auth.api.createOrganization({
         body: {
            name: input.name,
            slug,
         },
         headers,
      });

      const orgId = org.id;
      const orgSlug = org.slug ?? slug;

      // 2. Create team inside the organization
      const teamResult = await auth.api.createTeam({
         body: {
            name: input.name,
            organizationId: orgId,
            // @ts-expect-error Better Auth plugin accepts additionalFields not yet reflected in types
            accountType: input.accountType,
         },
         headers,
      });

      const teamId = teamResult.id;

      // 3. Add user as organization member (owner role) using server-only API
      await auth.api.addMember({
         body: {
            userId,
            organizationId: orgId,
            role: "owner",
            teamId,
         },
         headers,
      });

      // 4. Provision default resources for the team
      await provisionTeamResources(db, {
         organizationId: orgId,
         teamId,
         userId,
         products: ["finance"],
      });

      return { orgSlug, teamSlug: slug, orgId, teamId };
   });
```

**Step 4: Verify TypeScript compiles**

```bash
bun run typecheck
```

Expected: No new type errors in `onboarding.ts`.

---

## Task 2: Update `use-create-workspace.ts` to call the oRPC procedure

**Files:**
- Modify: `apps/web/src/features/onboarding/hooks/use-create-workspace.ts`

**Step 1: Rewrite `createWorkspace` async function**

Replace the entire content of `apps/web/src/features/onboarding/hooks/use-create-workspace.ts` with:

```typescript
import { useTransition } from "react";
import { toast } from "sonner";
import { authClient } from "@/integrations/better-auth/auth-client";
import { orpc } from "@/integrations/orpc/client";
import type { AccountType } from "../ui/account-type-step";

interface CreateWorkspaceOptions {
   name: string;
   accountType: AccountType;
}

interface CreateWorkspaceResult {
   orgSlug: string;
   teamSlug: string;
}

/**
 * Orchestrates the full workspace creation flow:
 * 1. Server: Create organization, team, add member, provision resources (oRPC)
 * 2. Client: Set active organization session
 * 3. Client: Set active team session
 */
async function createWorkspace({
   name,
   accountType,
}: CreateWorkspaceOptions): Promise<CreateWorkspaceResult> {
   const result = await orpc.onboarding.createWorkspace.call({
      name,
      accountType,
   });

   await authClient.organization.setActive({ organizationId: result.orgId });
   await authClient.organization.setActiveTeam({ teamId: result.teamId });

   return { orgSlug: result.orgSlug, teamSlug: result.teamSlug };
}

interface UseCreateWorkspaceReturn {
   createWorkspace: (
      options: CreateWorkspaceOptions,
   ) => Promise<CreateWorkspaceResult | null>;
   isPending: boolean;
}

/**
 * Hook that wraps the workspace creation flow with pending state and error toasts.
 * Returns null on failure (error is shown as toast).
 */
export function useCreateWorkspace(): UseCreateWorkspaceReturn {
   const [isPending, startTransition] = useTransition();

   const run = (
      options: CreateWorkspaceOptions,
   ): Promise<CreateWorkspaceResult | null> => {
      return new Promise((resolve) => {
         startTransition(async () => {
            try {
               const result = await createWorkspace(options);
               resolve(result);
            } catch (error) {
               toast.error(
                  error instanceof Error
                     ? error.message
                     : "Erro ao criar espaço.",
               );
               resolve(null);
            }
         });
      });
   };

   return { createWorkspace: run, isPending };
}
```

**Step 2: Verify TypeScript compiles**

```bash
bun run typecheck
```

Expected: No new type errors.

---

## Task 3: Verify Biome passes

```bash
bun run check
```

Expected: No lint or format errors. Fix any reported issues before committing.

---

## Task 4: Manual smoke-test

Start dev server:

```bash
bun dev
```

1. Sign up with a new email
2. Complete onboarding wizard (choose account type → enter workspace name → click Concluir)
3. Verify you land on `/$slug/$teamSlug/home`
4. Verify no console errors in browser or server

---

## Task 5: Commit

```bash
git add apps/web/src/integrations/orpc/router/onboarding.ts \
        apps/web/src/features/onboarding/hooks/use-create-workspace.ts
git commit -m "feat(onboarding): move workspace creation to server using auth.api.addMember"
```
