# Security Audit Methodology

Baseado nos padrões Piolium/Vigolium, mas reduzido para uso em PR/CI do Montte.

## Pipeline CI-friendly

1. **Recon rápido**
   - Liste arquivos alterados e componentes tocados.
   - Identifique runtimes: web SSR, browser, oRPC server, worker DBOS/pg-boss, scripts, CI.
   - Marque fronteiras: usuário anônimo/autenticado, organização, time, provider externo, banco, storage, filas.

2. **Threat model do escopo**
   - Quem é o atacante mais fraco que controla input?
   - Qual privilégio inicial ele tem?
   - Qual asset ou boundary pode ser quebrado?
   - Qual path de produção executa o código?

3. **Static + semantic review**
   - Grep/trace por sources e sinks relevantes ao diff.
   - Verifique validators Zod, ownership middleware, transações, constraints e sanitização.
   - Para workflow CI, cheque injeção por PR/comment/body, checkout de fork, exposição de secrets, permissões e shell interpolation.

4. **Manual probe**
   - Para cada hipótese, trace source → transform → authorization → sink.
   - Prefira uma hipótese forte a várias fracas.
   - Busque variantes no mesmo padrão se houver finding confirmado.

5. **FP check**
   - Tente provar que o finding é falso usando controles existentes.
   - Se o controle bloqueia em produção, descarte.
   - Se só depende de admin malicioso, runner trusted ou test fixture, descarte.

6. **Report**
   - JSON estruturado + Markdown curto.
   - Inclua somente achados acionáveis Medium+.

## Sources comuns

- Input de rota, query/search params, body JSON, upload, CSV/OFX/XLSX, webhooks.
- Better Auth session, organization/team ids, API keys, magic link/OTP.
- Provider callbacks, jobs enfileirados, AI tool calls, env vars, GitHub event payload.
- Dados cross-tenant lidos de URL/localStorage/cache.

## Sinks comuns

- Drizzle queries/escritas, `returning`, deletes/bulk actions.
- Billing/usage/invoice/entitlement.
- File storage, signed URLs, parsing de arquivos.
- DBOS workflows e pg-boss jobs.
- Shell em CI/scripts, `gh` commands, generated release/blog/docs automation.
- AI tool execution e prompts que decidem ações sensíveis.

## Heurística de prioridade

1. Cross-tenant/cross-team data access.
2. Auth bypass, session/API key/2FA regressions.
3. Billing/usage manipulation.
4. SSRF/path traversal/file disclosure/upload abuse.
5. Command injection/CI secrets exfiltration.
6. Durable workflow race/idempotency que gera impacto financeiro/security.
7. Prompt/tool injection com ação privilegiada real.
