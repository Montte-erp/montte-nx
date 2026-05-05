---
name: linear-documentation
description: Padrão de documentação Montte no Linear usando hierarquia nativa — Initiative, Project, Milestone, Cycle, Issue. Conteúdo pt-BR, team MON.
allowed-tools: Bash(linear:*)
---

# Linear Documentation — Montte

Convenção de documentação no Linear aproveitando toda a hierarquia nativa. Define **o que vai onde, em qual formato, e como criar via CLI**.

## Hierarquia

| Nível | Linear | Quando usar | Exemplo Montte |
|---|---|---|---|
| Tema estratégico | **Initiative** | Multi-quarter, agrupa vários projects | "Services Pricing Paradigm" |
| Entregável | **Project** | Feature shippable com fim claro | "Dashboard Centro de Custo" |
| Fase do project | **Milestone** | Marcos internos quando project é grande | "MVP", "V2", "Polish" |
| Sprint | **Cycle** | Janela temporal do team MON | Cycle 12 |
| Trabalho | **Issue** | Unidade rastreável (`MON-XXX`) | `MON-842` |
| Decomposição | **Sub-issue** | Quebra técnica de uma issue | tarefas de implementação |

Sem "User Story" / `[US-NN]`. Issue é issue.

## Convenções globais

- **Team:** `MON` sempre
- **Idioma:** pt-BR em todo conteúdo (initiative, project, milestone, issue, comentário)
- **Domínio:** tags chamam-se "Centro de Custo" — nunca "tags" em copy de usuário
- **Releases:** CalVer `vYYYY.MM.DD`, automatizado sexta 21:00 UTC — não criar issue manual de release
- **Ícones (`--icon`):** sem emojis salvo pedido explícito do usuário
- **Markdown:** sempre via `--description-file` / `--body-file` — nunca inline. Evita escape de shell e preserva formatação no Linear UI.
- **Status:** seguir flow do team MON, não criar estados custom

## Tipos de issue (label, não título)

Tipo vai em label `type:*`. Verificar existência antes com `linear label list`; criar se faltar.

- `type:feature` — novo comportamento de produto
- `type:bug` — corrigir defeito
- `type:chore` — manutenção, refactor, dep bump
- `type:spike` — investigação timeboxed
- `type:docs` — documentação

Título descreve o trabalho de forma direta. Sem prefixo numerado.

## Templates de descrição

Adaptativo por tipo. Nunca forçar BDD em chore/spike.

### Feature (`type:feature`)

```markdown
## Contexto
Por que existe, qual problema, quem pediu.

## Critérios de Aceite
- [ ] Verificável 1
- [ ] Verificável 2

## Cenários

### Cenário: [título]
**Dado** [pré-condição]
**Quando** [ação]
**Então** [resultado esperado]
```

### Bug (`type:bug`)

```markdown
## Reprodução
1. Passo
2. Passo

## Esperado
...

## Atual
...

## Ambiente
Branch / commit / env / org-id se relevante.
```

### Chore / Spike (`type:chore`, `type:spike`)

```markdown
## Motivação
Por que fazer agora.

## Escopo
O que está dentro e o que está fora.

## Saída esperada
Spike: decisão documentada / PoC / ADR.
Chore: estado final do código.
```

### Project (descrição do entregável)

```markdown
## Objetivo
Uma frase: o que entrega.

## Por quê
Problema / oportunidade.

## Escopo
Dentro / fora.

## Sucesso
Como saber que terminou (métrica ou critério binário).
```

### Initiative (tema estratégico)

```markdown
## Visão
Estado futuro em 1 parágrafo.

## Projects
Lista dos projects que compõem (links).

## Métricas-norte
Como medir progresso do tema.
```

## Regras de escolha de nível

- Issue isolada cabe? **Não criar project** — vai direto no backlog do team `MON`
- Project sem initiative? **OK** se a feature é standalone
- Milestone só se o project tem >5 issues E fases distintas
- Cycle é gerenciado pelo team MON — **não criar cycles ad-hoc** por feature
- Sub-issue só quando a parent é grande o suficiente pra justificar quebra rastreável; quebra menor vira checklist na descrição

## Comandos CLI

Sempre escrever markdown em `/tmp/<arquivo>.md` antes e passar com `--description-file`.

```bash
# Antes de qualquer coisa: descobrir o que já existe
linear label list
linear initiative list
linear project list --team MON

# Initiative (tema estratégico)
linear initiative create --name "Services Pricing Paradigm" --description-file /tmp/init.md

# Project (entregável) — vincular a initiative se aplicável
linear project create --name "Dashboard Centro de Custo" --description-file /tmp/proj.md
linear initiative add-project "Services Pricing Paradigm" "Dashboard Centro de Custo"

# Milestone (fase do project, só se project for grande)
linear milestone create --project "Dashboard Centro de Custo" --name "MVP"

# Issue dentro de project + label de tipo
linear issue create \
  --team MON \
  --project "Dashboard Centro de Custo" \
  --title "Badge de uso no card do Centro de Custo" \
  --description-file /tmp/issue.md
linear issue update MON-XXX --add-labels "type:feature"

# Bug solto (sem project)
linear issue create --team MON --title "Erro ao salvar..." --description-file /tmp/bug.md
linear issue update MON-XXX --add-labels "type:bug"

# Comentário com markdown
linear issue comment add MON-XXX --body-file /tmp/comment.md
```

## Fluxo de decisão

1. **Tema novo grande** → criar Initiative
2. **Feature dentro do tema** → criar Project + vincular à Initiative
3. **Project com >5 issues e fases distintas** → criar Milestones
4. **Trabalho concreto** → Issue no team MON, project quando aplicável, label `type:*`
5. **Sub-trabalho** → sub-issue da parent
6. **Bug solto sem feature** → issue direto no team, sem project, label `type:bug`

## Exemplo Montte

```markdown
## Contexto
Gestores não percebem estouro de Centro de Custo até o fim do mês, quando já não dá pra agir. Pedido recorrente em feedback de cliente.

## Critérios de Aceite
- [ ] Badge amarelo no card do CC quando uso > 80% do orçamento
- [ ] Badge vermelho quando uso > 100%
- [ ] Click no badge abre detalhe do CC com lançamentos do mês
- [ ] Alerta respeita timezone da organização

## Cenários

### Cenário: CC ultrapassa 80%
**Dado** um Centro de Custo com orçamento R$ 1.000 e gasto acumulado R$ 850
**Quando** o usuário abre o dashboard
**Então** o sistema exibe badge amarelo "85% utilizado" no card do CC

### Cenário: CC estoura o orçamento
**Dado** um Centro de Custo com orçamento R$ 1.000 e gasto acumulado R$ 1.120
**Quando** o usuário abre o dashboard
**Então** o sistema exibe badge vermelho "112% utilizado" no card do CC
```
