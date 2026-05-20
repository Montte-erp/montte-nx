# AI Runtime Review

Use para review em `modules/agents`, chat, AG-UI, assistant-ui, tool calls, AI telemetry, PostHog e skill routing.

Abra tambem [tanstack-ai](../../implementation/references/tanstack-ai.md).

## Runtime e chat

- Verifique a rota/chat transport atual antes de aceitar comentario sobre stream antigo.
- Prefira primitives upstream de assistant-ui/AG-UI quando o codigo ja esta nessa era.
- Nao criar shim/wrapper local para compatibilidade se a lib oferece caminho nativo.
- Tool-call UI deve renderizar estados semanticos distintos, inclusive discovery/loading/internal orchestration quando esses estados chegam ao client.
- Erros visiveis ficam em pt-BR.

## Tools e skills

- Tool read-only continua read-only quando o pedido foi so leitura.
- `active skill` / `skillHint` de PostHog e roteamento de skill sao comportamento de produto, nao detalhe cosmetico.
- Verifique nomes de tools/eventos/propriedades no schema atual antes de inferir por prompt.
- Nao vazar credenciais, tokens, payload sensivel ou prompt interno em logs/UI.

## Telemetria

- Use padroes OTEL/TanStack AI existentes antes de criar mini-framework.
- PostHog deve ser tratado como integracao oficial quando ja presente no fluxo.
- Se uma metrica mudou, descubra evento/propriedade atual antes de consultar.

## Validacao comum

- `bun --filter @modules/agents typecheck` ou alvo Nx equivalente
- teste do router/runtime tocado
- inspeção do contrato de mensagens quando o patch toca stream/tool calls
- `bunx oxfmt <arquivos>`
- `git diff --check`
