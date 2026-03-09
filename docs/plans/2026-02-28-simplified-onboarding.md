# Simplified Onboarding Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Simplify onboarding to max 2 steps (name + workspace), auto-create team behind the scenes, and redirect straight to dashboard.

**Architecture:** Workspace step absorbs all creation logic (org + team + completeOnboarding). Wizard removes Project and Products steps entirely. Navigation to dashboard happens from workspace step callback.

**Tech Stack:** React, TanStack Form, Better Auth client, oRPC, TanStack Router

---

## Task 1: Update `workspace-step.tsx` — absorb all creation logic

**Files:**

- Modify: `apps/web/src/features/onboarding/ui/workspace-step.tsx`

**Step 1: Replace the entire file content**

New submit flow in `onSubmit`:

1. `authClient.organization.create({ name, slug })`
2. `authClient.organization.setActive({ organizationId })`
3. `authClient.organization.createTeam({ name, organizationId, slug })` — same name+slug
4. `authClient.getSession()` — to get userId
5. `authClient.organization.addTeamMember({ teamId, userId })`
6. `authClient.organization.setActiveTeam({ teamId })`
7. `orpc.onboarding.completeOnboarding.call({ products: ["finance"] })`
8. Call `onNext({ orgSlug: result.slug, teamSlug: slug })`

Change the `onNext` prop signature from:

```typescript
onNext: (org: { id: string; slug: string }) => void;
```

to:

```typescript
onNext: (result: { orgSlug: string; teamSlug: string }) => void;
```

Remove entirely:

- All `fileUpload` / `useFileUpload` code
- All `presignedUpload` / `usePresignedUpload` code
- `saveMutation` and logo upload logic
- Logo `<Dropzone>` and `<Avatar>` JSX
- Unused imports: `Avatar`, `AvatarFallback`, `AvatarImage`, `Dropzone`, `DropzoneContent`, `DropzoneEmptyState`, `Camera`, `Building2`, `useMutation`

Update description text:

```tsx
<h2 className="font-serif text-2xl font-semibold">
  Crie seu espaço
</h2>
<p className="text-sm text-muted-foreground">
  Como você quer chamar seu espaço financeiro?
</p>
```

Full new `onSubmit`:

```typescript
onSubmit: async ({ value }) => {
  try {
    const slug = createSlug(value.workspaceName);

    const result = await authClient.organization.create({
      name: value.workspaceName,
      slug,
    });

    if (!result.data?.id) {
      throw new Error("Failed to create workspace");
    }

    const orgId = result.data.id;
    const orgSlug = result.data.slug ?? slug;

    await authClient.organization.setActive({ organizationId: orgId });

    const teamResult = await authClient.organization.createTeam({
      name: value.workspaceName,
      organizationId: orgId,
      slug,
    });

    if (!teamResult.data?.id) {
      throw new Error("Failed to create team");
    }

    const teamId = teamResult.data.id;

    const session = await authClient.getSession();
    if (!session?.data?.user?.id) {
      throw new Error("No active session");
    }

    await authClient.organization.addTeamMember({
      teamId,
      userId: session.data.user.id,
    });

    await authClient.organization.setActiveTeam({ teamId });

    await orpc.onboarding.completeOnboarding.call({ products: ["finance"] });

    onNext({ orgSlug, teamSlug: slug });
  } catch (error) {
    toast.error(
      error instanceof Error ? error.message : "Erro ao criar espaço.",
    );
  }
},
```

**Step 2: Verify no TypeScript errors**

```bash
cd /home/yorizel/Documents/montte-nx && npx tsc --noEmit -p apps/web/tsconfig.json 2>&1 | grep workspace-step
```

Expected: no errors for this file.

**Step 3: Commit**

```bash
git add apps/web/src/features/onboarding/ui/workspace-step.tsx
git commit -m "feat(onboarding): workspace step absorbs team creation and onboarding completion"
```

---

## Task 2: Update `onboarding-wizard.tsx` — remove project/products steps

**Files:**

- Modify: `apps/web/src/features/onboarding/ui/onboarding-wizard.tsx`

**Step 1: Remove unused imports and state**

Remove imports:

```typescript
import { ProductsStep } from "./products-step"; // remove
import { ProjectStep } from "./project-step"; // remove
```

Remove from `WizardState` type:

```typescript
// Remove teamId and teamSlug — no longer tracked in wizard
teamId: string | null;
teamSlug: string | null;
```

Remove state:

```typescript
const [projectSlug, setProjectSlug] = useState<string | null>(null); // remove
```

Remove callbacks:

```typescript
// Remove handleProjectComplete
// Remove handleOnboardingComplete
```

**Step 2: Update `steps` array — remove project and products**

```typescript
const steps = useMemo(() => {
   const s: { id: string; title: string }[] = [];
   if (needsProfile) s.push({ id: "profile", title: "Perfil" });
   if (needsWorkspace) s.push({ id: "workspace", title: "Workspace" });
   return s;
}, [needsProfile, needsWorkspace]);
```

**Step 3: Add edge-case redirect if no steps**

Add after steps useMemo (before Stepper definition):

```typescript
const navigate = useNavigate();

// Edge case: user already has name + org (partial old onboarding state).
// Shouldn't happen with new flow but guard against infinite redirect loops.
if (steps.length === 0) {
   navigate({ to: "/" });
   return null;
}
```

**Step 4: Update `handleWorkspaceComplete` to navigate directly**

```typescript
const handleWorkspaceComplete = useCallback(
   ({ orgSlug, teamSlug }: { orgSlug: string; teamSlug: string }) => {
      navigate({
         to: "/$slug/$teamSlug/home",
         params: { slug: orgSlug, teamSlug },
      });
   },
   [navigate],
);
```

**Step 5: Update `handleProfileComplete` for case with existing org**

```typescript
const handleProfileComplete = useCallback(
   (methods: { navigation: { next: () => void } }) => {
      if (needsWorkspace) {
         methods.navigation.next();
      }
      // If user has org (shouldn't happen in new flow) — edge case handled by steps.length === 0 guard above
   },
   [needsWorkspace],
);
```

**Step 6: Update Stepper.Provider — remove project/products cases and fix WorkspaceStep callback**

Remove from `methods.flow.switch`:

```typescript
// Remove project: () => (...)
// Remove products: () => (...)
```

Update WorkspaceStep callback:

```tsx
workspace: () => (
  <WorkspaceStep
    onNext={handleWorkspaceComplete}
    onSlugChange={setWorkspaceSlug}
    onStateChange={handleStepStateChange}
    ref={stepRef}
  />
),
```

**Step 7: Remove `projectSlug` from URL badge (already removed from state)**

Badge only shows `workspaceSlug`:

```tsx
<Badge className="bg-muted text-muted-foreground" variant="outline">
   app.montte.co
   {workspaceSlug ? `/${workspaceSlug}` : ""}
</Badge>
```

**Step 8: Verify TypeScript**

```bash
cd /home/yorizel/Documents/montte-nx && npx tsc --noEmit -p apps/web/tsconfig.json 2>&1 | grep onboarding-wizard
```

Expected: no errors.

**Step 9: Commit**

```bash
git add apps/web/src/features/onboarding/ui/onboarding-wizard.tsx
git commit -m "feat(onboarding): remove project and products steps from wizard"
```

---

## Task 3: Delete unused step files

**Files:**

- Delete: `apps/web/src/features/onboarding/ui/project-step.tsx`
- Delete: `apps/web/src/features/onboarding/ui/products-step.tsx`

**Step 1: Delete files**

```bash
rm apps/web/src/features/onboarding/ui/project-step.tsx
rm apps/web/src/features/onboarding/ui/products-step.tsx
```

**Step 2: Full TypeScript check**

```bash
cd /home/yorizel/Documents/montte-nx && npx tsc --noEmit -p apps/web/tsconfig.json 2>&1 | head -30
```

Expected: no errors.

**Step 3: Commit**

```bash
git add -A
git commit -m "chore(onboarding): delete unused project-step and products-step files"
```

---

## Task 4: Smoke test the flow manually

1. Start dev server: `bun dev`
2. Sign in with magic link (new account with no name)
3. Verify: Profile step shown → fill name → go to Workspace step
4. Verify: Workspace step shown with "Crie seu espaço" heading, no logo upload
5. Fill workspace name → click Continuar
6. Verify: redirects to `/$slug/$teamSlug/home`
7. Sign out, sign in again with email/password (account with name already set)
8. Verify: only Workspace step shown (no Profile step)
9. Verify: after submit, both org onboarding and project onboarding are marked complete (no redirect back to `/onboarding`)
