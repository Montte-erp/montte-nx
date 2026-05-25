# Report Schema

## JSON obrigatório

O agente de CI deve retornar JSON válido, sem markdown fences:

```json
{
   "summary": "Resumo curto em pt-BR.",
   "riskLevel": "none|medium|high|critical",
   "findings": [
      {
         "id": "SEC-001",
         "severity": "medium|high|critical",
         "title": "Título curto",
         "path": "modules/example/src/router/item.ts",
         "line": 42,
         "evidence": "Arquivo:linha e trecho/comportamento observado.",
         "attackerControl": "O que o atacante controla.",
         "reachablePath": "Rota/procedure/job/workflow até o sink.",
         "trustBoundary": "Boundary quebrada.",
         "impact": "Impacto concreto.",
         "fix": "Correção mínima recomendada.",
         "confidence": "medium|high"
      }
   ],
   "discarded": [
      {
         "title": "Hipótese descartada",
         "reason": "Por que não é finding."
      }
   ]
}
```

## Markdown recomendado

```markdown
## Security Audit

**Risco:** none|medium|high|critical
**Resumo:** ...

## Achados

### SEC-001 — Título

- **Severidade:** high
- **Local:** `path:line`
- **Controle do atacante:** ...
- **Path alcançável:** ...
- **Boundary:** ...
- **Impacto:** ...
- **Correção mínima:** ...

## Hipóteses descartadas

- ...
```

## Regras de saída

- `riskLevel` é a maior severidade em `findings`, ou `none` sem achados.
- `findings` não pode conter Low/Info.
- `line` precisa ser número positivo e apontar para evidência real.
- `confidence` deve ser `high` quando path e controle estão provados; `medium` quando há pequena incerteza mas impacto/path são fortes.
- Não inclua segredo real no relatório; redija ou masque.
