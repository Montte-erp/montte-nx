---
name: react-doctor
description: Rode React Doctor depois de tocar codigo React/TSX, UI, hooks, efeitos, TanStack Start/Query ou acessibilidade; use tambem para triagens deliberadas de performance/corretude React.
---

# React Doctor

Use esta skill quando uma tarefa alterar React, TSX, hooks, componentes, rotas TanStack Start, TanStack Query, acessibilidade, estado client-side ou fluxos de UI.

## Loop padrao

1. Termine a mudanca e a formatacao focada.
2. Rode React Doctor no escopo do diff antes de fechar:

```bash
bunx react-doctor@latest --scope changed
```

3. Leia os achados, corrija primeiro erros de seguranca/corretude/performance e rode de novo.
4. Se um achado for falso positivo ou divida tecnica fora do patch, registre no resumo final.

## Triagem completa sob demanda

Quando o usuario pedir `/doctor`, "doctor", "triagem React Doctor" ou uma limpeza deliberada:

```bash
bunx react-doctor@latest --scope full
```

Agrupe por severidade, corrija erros antes de warnings, reexecute ate o score parar de melhorar ou sobrar apenas divida explicita.

## Integração com oxlint

O lint normal do repo tambem carrega `oxlint-plugin-react-doctor` via `tooling/oxc/base.json` para regras leves no fluxo existente:

```bash
bun run check
```

React Doctor completo continua sendo obrigatorio para mudancas React porque o CLI traz o contexto de PR/diff e recomendacoes mais completas.
