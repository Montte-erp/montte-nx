# Frontend UI Review

Use para comments em `apps/web`, `apps/landing`, `packages/ui`, rotas TanStack, forms, tables, layout, a11y e copy visivel.

Abra tambem:

- [implementation](../../implementation/SKILL.md) para regras tecnicas.
- [design](../../design/SKILL.md) quando houver layout, produto, copy ou polish visual.

## Checklist

- Texto visivel em pt-BR.
- Rota TanStack com `head`, `pendingMs`, `pendingComponent`, `errorComponent` quando aplicavel, `loaderDeps` para search params.
- Search params com `.catch()`, nao `.optional()`.
- Componentes usam `useSuspenseQuery` + `QueryBoundary`; queries condicionais usam `skipToken` ou child condicional.
- Forms usam TanStack Form; forms em sheet usam `useSheet`.
- Campos tem `id`, `name`, `htmlFor`, `aria-invalid` e erro so quando tocado.
- Tabelas usam componentes de `@packages/ui/components/data-table`, estado em URL, action column sem export.
- Icon buttons tem dimensao fixa e tooltip se o icone nao for obvio.
- Sem cards dentro de cards, sem `space-*`/margin utilities quando o design system proibe.
- Layout nao pode sobrepor texto/controles em mobile ou desktop.

## Review de comportamento

- Preserve copy e labels existentes salvo quando o finding e sobre copy.
- Nao trocar `useSheet` por `useCredenza` em formularios.
- Fluxos nao-form podem usar `useCredenza`; confirmacao destrutiva usa `useAlertDialog`.
- Evite estado derivado; prefira `select`, memo local ou derivacao no render.
- Hooks ficam no topo. Para DnD/sensors, estabilize objetos de opcao sem violar regras de hooks.

## Validacao comum

- `bunx oxfmt <arquivos>`
- `bun --filter web typecheck` ou `bun nx run web:typecheck --skipSync`
- `bunx oxlint <arquivos>` quando o patch e lint-focused
- Playwright focado quando o finding e fluxo visual/comportamental
- `git diff --check`
