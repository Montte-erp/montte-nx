# Adversarial Review

Use quando o objetivo for revisar de forma mais dura sem aumentar falso positivo. A regra e refute-or-promote: todo achado candidato precisa passar por uma tentativa honesta de refutacao antes de virar comentario, fix ou blocker.

## Entrada minima

- Intencao do patch em uma frase.
- Diff ou arquivos atuais completos quando o risco depende de contexto.
- Regras aplicaveis de `AGENTS.md`, desta skill e referencias de dominio.
- Comentarios/reviews anteriores para dedupe.
- Checks/CI quando disponiveis.

## Lentes

`Quebra producao`

- O que acontece com input vazio, duplicado, enorme, fora de ordem ou invalido?
- E se o provider falhar, atrasar, retornar shape inesperado ou executar duas vezes?
- Alguma escrita deixa estado parcial, dinheiro errado, data errada ou pagina desordenada?

`Contrato Montte`

- O patch viola ownership, team/org scope, module boundaries ou imports frontend?
- oRPC, Better Result, Drizzle, TanStack Query/DB/Form/Router seguem o contrato local?
- User-facing copy e erros continuam em pt-BR?

`Seguranca e dados`

- Existe novo caminho para IDOR, privilege escalation, injection ou vazamento de segredo?
- Logs, toasts, payloads e responses expoem dado sensivel?
- PR/comment/body de usuario esta sendo tratado como dado nao confiavel em automacoes?

`Minimalista`

- A mudanca resolve a intencao com o menor diff razoavel?
- Algum helper, fallback, barrel, repository layer ou wrapper foi criado sem necessidade real?
- Testes provam comportamento ou so congelam implementacao?

## Refutacao

Para cada candidato:

1. Cite arquivo/linha atual e, se for cross-file, o uso que fecha a cadeia.
2. Descreva o cenario de falha concreto.
3. Procure evidencia contraria: teste existente, guard, middleware, constraint, helper, dedupe ou comentario anterior.
4. Classifique `valid`, `stale`, `duplicate`, `not_reproducible`, `out_of_scope` ou `disputed`.
5. Publique/corrija somente `valid`; `disputed` fica no summary apenas quando o risco e relevante.

## Promocao

- Promova severidade quando duas lentes independentes chegam na mesma causa.
- Promova quando CI falho confirma o mesmo caminho.
- Rebaixe quando o impacto depende de decisao de produto, refactor amplo ou premissa nao provada.
- Nunca promova por volume de comentarios; promova por causa e evidencia.

## Saida

Para cada finding aceito, mantenha:

- problema;
- impacto concreto;
- evidencia com arquivo/linha;
- lente que encontrou;
- correcao pequena;
- status `valid`.

Findings sem linha comentavel, baixa confianca, refutados ou duplicados devem ir para artefato/summary, nao para inline.
