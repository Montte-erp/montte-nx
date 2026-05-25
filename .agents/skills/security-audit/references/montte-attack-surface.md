# Montte Attack Surface

## Auth e tenancy

- Better Auth é fonte de sessão, organização, time, membros, convites, 2FA e API keys.
- `member.id` não é `user.id`; confusão pode quebrar autorização.
- APIs devem respeitar `organizationId` e `teamId`; handlers não devem confiar em IDs vindos do client sem ownership middleware.
- Frontend pode carregar slugs e search params, mas servidor precisa revalidar ownership.

Checklist:

- Procedure protegida usa contexto autenticado correto?
- Entidade consultada pertence ao `teamId`/`organizationId` ativo?
- Bulk action valida ownership de todos os IDs no servidor?
- API key tem escopo correto e não herda privilégios indevidos?
- Convite/2FA/magic-link não permite troca de org/time por parâmetro controlado?

## oRPC e dados

- Routers vivem em `modules/*/src/router` e agregam em `apps/web/src/integrations/orpc/router`.
- Falhas esperadas usam tagged errors; isso não é segurança por si só.
- Toda escrita deve ocorrer em transação; mas transação não substitui authorization.

Riscos:

- `findFirst`/`update`/`delete` sem filtro de tenant.
- `returning()` usado sem checar ownership anterior.
- Client envia `teamId`/`organizationId` e servidor confia.
- Query listagem filtra, mas detail/update/delete não filtra.

## Billing, usage e entitlement

- Billing é usage-based; customer = Better Auth organization.
- Usage events, invoices, subscription items, coupons e entitlements são security-sensitive.

Riscos:

- Usuário altera meter/quantity/price/coupon indevidamente.
- Race/idempotency gera cobrança duplicada, crédito indevido ou bypass de limite.
- Workflow financeiro usa input vindo do client sem rechecagem de org/team.

## Files e importações

- Uploads, CSV, OFX, XLSX e storage MinIO são fronteiras de parser e acesso a arquivo.

Riscos:

- Path traversal em object keys.
- Signed URL sem ownership.
- Parser aceita fórmula/macro/conteúdo malicioso que chega a export ou preview.
- Import cria entidades em tenant errado.

## Workers: DBOS e pg-boss

- DBOS roda em `apps/worker`; web apenas enfileira.
- Jobs precisam Zod input schema e carregar `teamId`/`organizationId` quando aplicável.

Riscos:

- Job payload manipulável executa ação cross-tenant.
- Workflow self-reschedule com ID não determinístico gera duplicação explorável.
- Falta de idempotência em ações financeiras/security-critical.
- Consumer roda side effect antes de validar payload.

## AI agents e tools

- Prompt/tool injection só é finding quando leva a ação privilegiada, exfiltração ou mudança de dados.

Riscos:

- Tool usa texto do usuário como comando/query privilegiada.
- Agent decide ownership/permission sem checagem determinística.
- Logs/prompts capturam segredo ou PII sem redaction.

## GitHub Actions e automações

- Workflows de release, blog, docs, PR review e triage usam payloads GitHub e secrets.
- Nunca exponha secrets a PR de fork ou código não confiável.

Riscos:

- `pull_request_target` + checkout de head não confiável.
- Shell interpolation de título/body/branch/comment sem quoting.
- Permissões amplas (`contents: write`, `id-token: write`) sem necessidade.
- Comentário slash-command acionável por usuário sem permissão.
