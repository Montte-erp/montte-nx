# Finding Validation

## Finding gate

Só reporte se todos forem verdadeiros:

- **Controle do atacante:** input vem de usuário, tenant, webhook, arquivo, PR/comment, provider ou rede externa.
- **Path alcançável:** existe rota/procedure/job/workflow/CI que executa em runtime relevante.
- **Boundary cruzada:** cross-user, cross-team, cross-org, privilege escalation, secret exposure, execução de comando, impacto financeiro ou acesso a serviço interno.
- **Controle ausente:** não há middleware, ownership check, Zod schema, DB constraint, framework default ou policy que bloqueie.
- **Impacto concreto:** descreve asset afetado e consequência real.

Se qualquer item for ambíguo, trate como hipótese e não como finding final.

## False positive patterns

Descarte por padrão:

- Código test-only, seed, fixture, generated file ou story/demo.
- Script local onde o atacante já tem shell equivalente.
- Admin-only safety sem abuso cross-privilege.
- Dependência vulnerável não usada no runtime afetado.
- Same-user UI/cache/localStorage sem boundary maior.
- Robustez, observabilidade, deadlock, retry ou data-loss sem atacante real.
- Falha que exige controlar env var secret, deploy config ou código fonte.
- Comportamento documentado/esperado do framework ou provider.

## Severidade

- **Critical:** RCE remoto, exfiltração massiva cross-tenant, bypass auth global, secrets de produção expostos com exploração direta, impacto financeiro sistêmico.
- **High:** acesso/escrita cross-org ou cross-team, privilege escalation relevante, SSRF para serviço interno sensível, CI secrets exfil em PR trusted, billing abuse material.
- **Medium:** quebra limitada de boundary, acesso parcial a dados sensíveis, IDOR restrito, upload/path traversal limitado, race explorável com impacto moderado.
- **Low/Info:** hardening, best practice, same-user, exploit imprático, impacto baixo. Não entra no relatório final.

## Evidência mínima

Cada finding precisa incluir:

```text
Arquivo: path/to/file.ts:123
Source: qual input o atacante controla
Path: rota/procedure/job → função → sink
Sink: operação sensível
Controle ausente: check esperado e onde deveria estar
Impacto: consequência concreta
Correção mínima: mudança pequena e verificável
```

## Refutação obrigatória

Antes de finalizar, responda:

1. O framework valida/sanitiza isso automaticamente?
2. O middleware de auth/ownership já garante o boundary?
3. O schema Zod restringe input suficientemente?
4. O banco tem constraint ou query sempre filtra `organizationId`/`teamId`?
5. O código roda só em dev/test/CI sem secrets?
6. A exploração exige privilégio equivalente ao impacto?

Se qualquer resposta bloquear a exploração, descarte ou reduza severidade.
