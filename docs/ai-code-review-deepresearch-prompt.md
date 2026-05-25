# Prompt de Deep Research — AI Code Review

Use este prompt para pesquisar como construir um agente de code review automático no nível de Cubic, Greptile e CodeRabbit AI.

```text
Faça uma pesquisa profunda sobre como construir um agente de code review automático no nível de Cubic, Greptile e CodeRabbit AI.

Contexto:
- Repositório TypeScript monorepo com GitHub Actions.
- Orquestrador desejado: Flue agents.
- Modelo/provedor: OpenCode Go com DeepSeek V4 Flash.
- O agente deve revisar Pull Requests automaticamente.
- Deve carregar AGENTS.md e skills/regras do repositório.
- Deve gerar comentários úteis em PRs, preferencialmente em pt-BR.
- O objetivo é qualidade comparável a Cubic, Greptile e CodeRabbit AI, não um wrapper simples de diff.

Pesquise e compare:

1. Como Cubic faz code review:
   - arquitetura provável
   - tipos de análise
   - uso de contexto do repositório
   - deduplicação de comentários
   - severidade/priorização
   - inline comments vs comentário único
   - integração com GitHub

2. Como Greptile faz code review:
   - indexação/retrieval do codebase
   - entendimento semântico do repositório
   - review incremental de PR
   - uso de contexto cross-file
   - heurísticas para evitar falso positivo

3. Como CodeRabbit AI faz code review:
   - pipeline de análise
   - summaries
   - line comments
   - actionable suggestions
   - grouping por severidade
   - review de CI/falhas/testes
   - como lida com nits e ruído

4. Boas práticas gerais para AI code review:
   - coleta de contexto ideal
   - chunking de diffs grandes
   - RAG/indexação local
   - AST/static analysis
   - regras de segurança
   - checagem de testes/CI
   - confiança/confidence score
   - prevenção de hallucination
   - dedupe contra comentários anteriores
   - priorização de findings acionáveis
   - como formatar comentários para devs

5. Proponha uma arquitetura concreta para GitHub Actions + Flue:
   - etapas do workflow
   - payloads
   - arquivos gerados
   - como coletar diff, metadata, CI, comentários prévios
   - como coletar contexto do código ao redor
   - como indexar ou buscar contexto cross-file sem serviço externo
   - como chamar o LLM em múltiplas passagens
   - schemas JSON para findings
   - schema para comentário final
   - quando postar comentário único vs inline
   - como evitar comentar em forks sem secrets

6. Proponha prompts concretos:
   - prompt para análise estruturada
   - prompt para dedupe/stale check
   - prompt para síntese final em Markdown
   - prompt para inline comments
   - prompt para review de CI/test failure

7. Entregue recomendações práticas em ordem de implementação:
   - MVP robusto
   - versão intermediária
   - versão avançada
   - riscos técnicos
   - limitações
   - tradeoffs

Formato da resposta:
- Seja técnico e específico.
- Inclua exemplos de schemas JSON.
- Inclua exemplos de prompts.
- Inclua comandos GitHub CLI/API úteis.
- Foque em implementação prática, não marketing.
- Se mencionar limitações/prováveis detalhes internos dessas ferramentas, sinalize claramente quando for inferência.
```
