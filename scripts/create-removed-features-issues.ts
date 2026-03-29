import { execSync } from "node:child_process";

const REPO = "Montte-erp/montte-nx";

const issues = [
   {
      title: "feat(settings): reintroduce Webhooks in project settings",
      body: `## Context

Webhooks were removed from the settings UI as the feature is not yet fully supported.

## What needs to be done

- Re-add the \`project-webhooks\` nav item in \`settings-nav-items.ts\`
- Restore route \`settings/project/webhooks.tsx\`
- Restore feature folder \`features/webhooks/\`
- Restore oRPC router \`router/webhooks.ts\` and wire it back to the main router
- Add proper delivery retries and event catalog UI`,
      labels: ["enhancement"],
   },
   {
      title: "feat(settings): reintroduce Controle de Acesso in project settings",
      body: `## Context

Access Control was removed from the settings UI as the feature is not yet fully supported.

## What needs to be done

- Re-add the \`project-access-control\` nav item in \`settings-nav-items.ts\`
- Restore route \`settings/project/access-control.tsx\`
- Restore feature folder \`features/access-control/\`
- Design proper RBAC model for team-level access control`,
      labels: ["enhancement"],
   },
   {
      title: "feat(settings): implement Registro de Atividades (Activity Logs)",
      body: `## Context

Activity Logs were referenced in the nav but never implemented. Removed from nav to avoid dead links.

## What needs to be done

- Create route \`settings/project/activity-logs.tsx\`
- Create oRPC procedure to query activity log events
- Design activity log schema (who, what, when, resource)
- Add \`project-activity-logs\` nav item back to \`settings-nav-items.ts\``,
      labels: ["enhancement"],
   },
   {
      title: "feat(settings): implement Funções (Roles) in organization settings",
      body: `## Context

Organization Roles were referenced in the nav but never implemented. Removed from nav to avoid dead links.

## What needs to be done

- Create route \`settings/organization/roles.tsx\`
- Design custom roles model on top of Better Auth member roles
- Add \`org-roles\` nav item back to \`settings-nav-items.ts\``,
      labels: ["enhancement"],
   },
   {
      title: "feat(settings): reintroduce SSO & Auth Domains in organization settings",
      body: `## Context

SSO and Auth Domains (organization/authentication) were removed as the feature is gated behind Enterprise addon and not fully built.

## What needs to be done

- Restore route \`settings/organization/authentication.tsx\`
- Restore feature folder \`features/sso/\`
- Implement SAML 2.0 / OIDC integration via Better Auth SSO plugin
- Implement verified domain auto-join flow
- Re-add \`org-authentication\` nav item`,
      labels: ["enhancement"],
   },
   {
      title: "feat(settings): reintroduce Segurança in organization settings",
      body: `## Context

Organization Security settings were removed as the feature is not yet fully supported.

## What needs to be done

- Restore route \`settings/organization/security.tsx\`
- Define org-level security policies (2FA enforcement, session policies, IP allowlists)
- Re-add \`org-security\` nav item`,
      labels: ["enhancement"],
   },
   {
      title: "feat(search): reintroduce global search feature",
      body: `## Context

The global search feature and page were removed as the implementation was incomplete and the UX needed a complete rethink.

## What needs to be done

- Redesign the search UX (command palette vs dedicated page)
- Restore or rewrite \`features/search/\`
- Restore or rewrite \`router/search.ts\` (globalSearch procedure)
- Restore route \`search.tsx\`
- Consider integrating with a proper full-text search solution`,
      labels: ["enhancement"],
   },
];

for (const issue of issues) {
   console.log(`\nCreating: ${issue.title}`);
   const labelFlags = issue.labels.map((l) => `--label "${l}"`).join(" ");
   execSync(
      `gh issue create --repo ${REPO} --title "${issue.title.replace(/"/g, '\\"')}" --body "${issue.body.replace(/"/g, '\\"').replace(/\n/g, "\\n")}" ${labelFlags}`,
      { stdio: "inherit" },
   );
}

console.log("\nDone! All issues created.");
