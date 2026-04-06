# Settings & Search Cleanup Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove unsupported settings sections (domains, webhooks, access-control, activity-logs, funções, SSO, org-security) and the search feature, plus add project name editing to the general settings page.

**Architecture:** File deletions + nav item removals + general.tsx refactor to add name editing form. No new routes created. All removed features get GitHub issues via a script.

**Tech Stack:** React/Vite, TanStack Router, oRPC, Better Auth, TanStack Form, GitHub CLI (`gh`)

---

### Task 1: Create and run GitHub issues script

**Files:**

- Create: `scripts/create-removed-features-issues.ts`

**Step 1: Create the script**

```typescript
import { execSync } from "node:child_process";

const REPO = "Montte-erp/montte-nx";

const issues = [
   {
      title: "feat(settings): reintroduce Webhooks in project settings",
      body: `## Context\nWebhooks were removed from the settings UI as the feature is not yet fully supported.\n\n## What needs to be done\n- Re-add the \`project-webhooks\` nav item in \`settings-nav-items.ts\`\n- Restore route \`settings/project/webhooks.tsx\`\n- Restore feature folder \`features/webhooks/\`\n- Restore oRPC router \`router/webhooks.ts\` and wire it back to the main router\n- Add proper delivery retries and event catalog UI\n\n## Labels\n\`feature\`, \`settings\``,
      labels: "feature,enhancement",
   },
   {
      title: "feat(settings): reintroduce Controle de Acesso in project settings",
      body: `## Context\nAccess Control was removed from the settings UI as the feature is not yet fully supported.\n\n## What needs to be done\n- Re-add the \`project-access-control\` nav item in \`settings-nav-items.ts\`\n- Restore route \`settings/project/access-control.tsx\`\n- Restore feature folder \`features/access-control/\`\n- Design proper RBAC model for team-level access control\n\n## Labels\n\`feature\`, \`settings\``,
      labels: "feature,enhancement",
   },
   {
      title: "feat(settings): implement Registro de Atividades (Activity Logs)",
      body: `## Context\nActivity Logs were referenced in the nav but never implemented. Removed from nav to avoid dead links.\n\n## What needs to be done\n- Create route \`settings/project/activity-logs.tsx\`\n- Create oRPC procedure to query activity log events\n- Design activity log schema (who, what, when, resource)\n- Add \`project-activity-logs\` nav item back to \`settings-nav-items.ts\`\n\n## Labels\n\`feature\`, \`settings\``,
      labels: "feature,enhancement",
   },
   {
      title: "feat(settings): implement Funções (Roles) in organization settings",
      body: `## Context\nOrganization Roles were referenced in the nav but never implemented. Removed from nav to avoid dead links.\n\n## What needs to be done\n- Create route \`settings/organization/roles.tsx\`\n- Design custom roles model on top of Better Auth member roles\n- Add \`org-roles\` nav item back to \`settings-nav-items.ts\`\n\n## Labels\n\`feature\`, \`settings\``,
      labels: "feature,enhancement",
   },
   {
      title: "feat(settings): reintroduce SSO & Auth Domains in organization settings",
      body: `## Context\nSSO and Auth Domains (organization/authentication) were removed as the feature is gated behind Enterprise addon and not fully built.\n\n## What needs to be done\n- Restore route \`settings/organization/authentication.tsx\`\n- Restore feature folder \`features/sso/\`\n- Implement SAML 2.0 / OIDC integration via Better Auth SSO plugin\n- Implement verified domain auto-join flow\n- Re-add \`org-authentication\` nav item\n\n## Labels\n\`feature\`, \`settings\`, \`enterprise\``,
      labels: "feature,enhancement",
   },
   {
      title: "feat(settings): reintroduce Segurança in organization settings",
      body: `## Context\nOrganization Security settings were removed as the feature is not yet fully supported.\n\n## What needs to be done\n- Restore route \`settings/organization/security.tsx\`\n- Define org-level security policies (2FA enforcement, session policies, IP allowlists)\n- Re-add \`org-security\` nav item\n\n## Labels\n\`feature\`, \`settings\``,
      labels: "feature,enhancement",
   },
   {
      title: "feat(search): reintroduce global search feature",
      body: `## Context\nThe global search feature and page were removed as the implementation was incomplete and the UX needed a complete rethink.\n\n## What needs to be done\n- Redesign the search UX (command palette vs dedicated page)\n- Restore or rewrite \`features/search/\`\n- Restore or rewrite \`router/search.ts\` (globalSearch procedure)\n- Restore route \`search.tsx\`\n- Consider integrating with a proper full-text search solution\n\n## Labels\n\`feature\`, \`search\``,
      labels: "feature,enhancement",
   },
];

for (const issue of issues) {
   console.log(`Creating issue: ${issue.title}`);
   execSync(
      `gh issue create --repo ${REPO} --title ${JSON.stringify(issue.title)} --body ${JSON.stringify(issue.body)} --label ${issue.labels}`,
      { stdio: "inherit" },
   );
}

console.log("Done! All issues created.");
```

**Step 2: Run the script**

```bash
bun run scripts/create-removed-features-issues.ts
```

Expected: 7 issues created in Montte-erp/montte-nx.

**Step 3: Commit**

```bash
git add scripts/create-removed-features-issues.ts
git commit -m "chore: add script to create removed-feature tracking issues"
```

---

### Task 2: Remove webhooks, access-control, SSO, org-security routes + feature folders

**Files:**

- Delete: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/settings/project/webhooks.tsx`
- Delete: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/settings/project/access-control.tsx`
- Delete: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/settings/organization/authentication.tsx`
- Delete: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/settings/organization/security.tsx`
- Delete: `apps/web/src/features/webhooks/` (entire folder)
- Delete: `apps/web/src/features/access-control/` (entire folder)
- Delete: `apps/web/src/features/sso/` (entire folder)
- Modify: `apps/web/src/integrations/orpc/router/index.ts` — remove webhooks import/registration
- Delete: `apps/web/src/integrations/orpc/router/webhooks.ts`
- Delete: `apps/web/src/integrations/orpc/router/search.ts`
- Delete: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/search.tsx`
- Delete: `apps/web/src/features/search/` (entire folder)
- Regenerate: `apps/web/src/routeTree.gen.ts` (auto-generated, run `bun dev` or `bun run typecheck`)

**Step 1: Delete route files**

```bash
rm apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/settings/project/webhooks.tsx
rm apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/settings/project/access-control.tsx
rm apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/settings/organization/authentication.tsx
rm apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/settings/organization/security.tsx
rm apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/search.tsx
```

**Step 2: Delete feature folders**

```bash
rm -rf apps/web/src/features/webhooks
rm -rf apps/web/src/features/access-control
rm -rf apps/web/src/features/sso
rm -rf apps/web/src/features/search
```

**Step 3: Delete oRPC routers**

```bash
rm apps/web/src/integrations/orpc/router/webhooks.ts
rm apps/web/src/integrations/orpc/router/search.ts
```

**Step 4: Remove webhooks + search from the main router index**

Open `apps/web/src/integrations/orpc/router/index.ts` and remove:

- The `webhooks` import and its entry in the router object
- The `search` import and its entry in the router object

**Step 5: Run typecheck to regenerate routeTree and confirm no broken imports**

```bash
bun run typecheck
```

Fix any remaining import errors (e.g. if search is referenced somewhere else).

**Step 6: Commit**

```bash
git add -A
git commit -m "chore: remove webhooks, access-control, SSO, org-security, and search features"
```

---

### Task 3: Clean up settings nav items

**Files:**

- Modify: `apps/web/src/layout/dashboard/ui/settings-nav-items.ts`

**Step 1: Remove these nav items from the file**

From the `project` section, remove:

- `project-webhooks` (Webhooks)
- `project-access-control` (Controle de acesso)
- `project-activity-logs` (Registro de atividades)

From the `organization` section, remove:

- `org-roles` (Funções)
- `org-authentication` (Domínios de auth & SSO)
- `org-security` (Segurança)

Also remove unused icon imports: `Webhook`, `ShieldCheck`, `ScrollText`, `UserCog`, `Globe`, `Lock`

**Step 2: Verify the file looks correct**

Remaining nav items after cleanup:

**Espaço section:**

- Geral
- Módulos (with children)
- Integrações
- Zona de perigo

**Organização section:**

- Geral
- Membros
- Faturamento
- Zona de perigo

**Step 3: Commit**

```bash
git add apps/web/src/layout/dashboard/ui/settings-nav-items.ts
git commit -m "chore(settings): remove unsupported nav items"
```

---

### Task 4: Refactor general.tsx — remove domains, add project name editing

**Files:**

- Modify: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/settings/project/general.tsx`

**Context:** The oRPC team router currently has `updateAllowedDomains` but no `updateName`. We need to check if Better Auth's `team.update` is available and add an oRPC procedure for it, or use `authClient.organization.updateTeam` directly.

**Step 1: Check what's available in the team router**

Read `apps/web/src/integrations/orpc/router/team.ts` to see existing procedures.

**Step 2: Rewrite general.tsx**

Remove:

- All domain-related state (`newDomain`, `allowedDomains`)
- `updateDomainsMutation` and all domain handlers
- The entire "Domínios Permitidos" section JSX
- `Globe`, `X` imports

Add:

- TanStack Form for the project name field
- `useTransition` for loading state
- Call `authClient.organization.updateTeam({ teamId, data: { name } })` directly inside `onSubmit` — **do NOT wrap in useMutation**
- `isPending` from `useTransition` drives button disabled/spinner

```typescript
const [isPending, startTransition] = useTransition();

const form = useForm({
   defaultValues: { name: teamData.name },
   onSubmit: async ({ value }) => {
      const { error } = await authClient.organization.updateTeam({
         teamId,
         data: { name: value.name },
      });
      if (error) {
         toast.error("Não foi possível atualizar o nome.");
         return;
      }
      toast.success("Nome atualizado!");
      queryClient.invalidateQueries({
         queryKey: orpc.team.get.queryOptions({ input: { teamId } }).queryKey,
      });
   },
});

const handleSubmit = useCallback(
   (e: React.FormEvent) => {
      e.preventDefault();
      e.stopPropagation();
      startTransition(async () => {
         await form.handleSubmit();
      });
   },
   [form],
);
```

The page should have:

1. **Configurações do Espaço** section — project name (editable via TanStack Form), project ID (read-only)
2. **Resumo do Espaço** section — created at date

Name the section header "Configurações do Espaço" (not "Projeto") throughout.

**Step 3: Run typecheck**

```bash
bun run typecheck
```

**Step 4: Commit**

```bash
git add apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/settings/project/general.tsx
git commit -m "feat(settings): add project name editing, remove domains section"
```

---

### Task 5: Final verification

**Step 1: Run full typecheck**

```bash
bun run typecheck
```

Expected: No errors.

**Step 2: Run linter**

```bash
bun run check
```

Expected: No errors.

**Step 3: Verify routeTree.gen.ts no longer references deleted routes**

```bash
grep -E "webhooks|access-control|activity-logs|authentication|org.*security|search" apps/web/src/routeTree.gen.ts
```

Expected: No matches for the deleted routes.
