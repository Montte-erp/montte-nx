# Deep research — user-facing technical docs strategy for Flue

Data: 2026-05-25

## Objetivo

Definir como escrever a documentação pública do Flue em `/docs`: simples o bastante para usuários leigos entenderem e começarem, mas precisa e profunda o bastante para usuários avançados confiarem como referência técnica.

Essas docs têm dois consumidores principais:

- **usuários humanos**, que vão ler `/docs` para entender o produto e se virar sozinhos;
- **Montte AI**, que vai usar as mesmas docs como base confiável para explicar ao usuário como as coisas funcionam.

Essa estratégia deve orientar:

- conteúdo gerado pelo agente semanal `docs-refresh`;
- revisão humana dos PRs de documentação;
- arquitetura de informação da landing `/docs`;
- tom, templates e guardrails para docs geradas por IA;
- estrutura de conteúdo que funcione bem para leitura humana e retrieval/grounding por IA.

## Fontes pesquisadas

- Diátaxis — `https://diataxis.fr/` e `https://www.diataxis.fr/map/`
- Google Developer Documentation Style Guide — `https://developers.google.com/style/tone`
- Google Technical Writing — Audience/Documents — `https://developers.google.com/tech-writing/one/audience`, `https://developers.google.com/tech-writing/one/documents`
- MDN — Creating effective technical documentation — `https://developer.mozilla.org/en-US/blog/technical-writing/`
- Write the Docs — Software documentation guide — `https://www.writethedocs.org/guide/`
- Stripe Docs/API reference — `https://docs.stripe.com/api`

## Achados principais

### 1. Documentação precisa responder a intenções diferentes

Diátaxis separa documentação em quatro modos:

| Modo | Pergunta do usuário | Uso no Flue |
|---|---|---|
| Tutorial | “Can you teach me?” | Quickstart, primeiro agente, primeiro deploy |
| How-to guide | “How do I do X?” | suporte, triagem em CI, MCP, Cloudflare, Daytona |
| Reference | “What is the exact API/command?” | `@flue/runtime`, `@flue/cli`, config, options |
| Explanation | “Why does it work this way?” | harness/session model, sandbox trade-offs, runtime-agnostic design |

Para Flue, isso significa que `/docs` não deve ser só uma lista de APIs nem só um tutorial longo. Precisa ter rotas e seções que deixem claro o tipo de ajuda que o usuário está buscando.

### 2. A mesma página pode ter camadas, mas não pode misturar intenções sem controle

Como a docs será user-facing, muitas páginas precisam servir dois públicos:

- iniciante: quer entender “o que é isso?” e copiar um exemplo;
- avançado: quer detalhes de runtime, limites, trade-offs e API.

O padrão recomendado é **progressive disclosure**:

1. explicar em linguagem simples;
2. mostrar um exemplo mínimo;
3. explicar como funciona;
4. mostrar detalhes avançados;
5. fechar com referência ou próximos passos.

Isso evita dois extremos ruins:

- docs fáceis, mas superficiais demais para produção;
- docs completas, mas intimidadoras para quem chegou agora.

### 3. Usuário vem com tarefa, não com vontade de ler arquitetura

Google Technical Writing define boa documentação como:

> conhecimento e habilidades que o público precisa para realizar uma tarefa, menos o que ele já sabe.

Aplicação para Flue:

- começar páginas com o objetivo prático;
- declarar pré-requisitos;
- não assumir que todo usuário conhece agent harness, sandboxes, Durable Objects, MCP ou CI;
- introduzir termos antes de usá-los em profundidade;
- explicar conceitos comparando com ferramentas que o público conhece: Claude Code, Codex, OpenCode, Pi, Next.js/Astro.

### 4. Tom deve ser claro, direto e respeitoso

Google recomenda voz conversacional, amigável e respeitosa, sem gírias, sem exagerar no informal e sem soar pedante.

Para Flue:

- usar inglês simples e global;
- evitar idioms/culture-specific jokes;
- evitar “simply”, “easy”, “just” quando isso pode diminuir a dificuldade real;
- falar como um engenheiro experiente sentado ao lado do usuário;
- não misturar marketing agressivo dentro das páginas de docs.

### 5. Clareza, concisão e consistência são mais importantes que estilo bonito

MDN resume o núcleo da escrita técnica em:

- clarity;
- conciseness;
- consistency.

Aplicação:

- uma ideia por frase quando possível;
- parágrafos curtos;
- termos consistentes: não alternar “agent instance”, “agent run”, “session” e “thread” se significam coisas diferentes;
- exemplos curtos, reais e copiáveis;
- headings descritivos;
- links com texto descritivo.

### 6. Reference precisa ser seca, completa e confiável

Stripe é bom exemplo de docs que combinam:

- visão simples no topo;
- exemplos executáveis;
- referência precisa;
- status codes/errors/limites;
- avisos de segurança sobre API keys.

Para Flue:

- páginas reference devem ser menos narrativas;
- cada opção/config deve ter tipo, default, quando usar, exemplo e limitações;
- comandos CLI devem ter flags, exemplos e efeitos;
- API docs devem distinguir Node-only, Cloudflare-only e runtime-agnostic.

## Princípio central para Flue

> Every public docs page should start beginner-friendly, end production-useful, and be safe for Montte AI to quote.

Tradução prática:

- a abertura deve ser compreensível para alguém novo em agentes;
- o exemplo deve funcionar sem contexto excessivo;
- o meio deve explicar o modelo mental;
- o final deve dar detalhes que um usuário avançado precisa para usar em produção;
- cada seção deve poder ser recuperada por IA sem induzir uma resposta errada ou incompleta.

## Dual-use docs: humanos e Montte AI

As páginas de `/docs` devem ser a fonte canônica tanto para self-service quanto para respostas do Montte AI. Isso muda o jeito de escrever.

### Requisitos para humanos

- A página precisa responder rapidamente: “isso resolve meu problema?”
- O usuário deve conseguir copiar um exemplo e adaptar.
- Conceitos novos precisam ser explicados antes do uso técnico.
- Troubleshooting deve cobrir erros comuns sem obrigar contato com suporte.
- Próximos passos devem guiar o usuário para a próxima ação.

### Requisitos para Montte AI

- Seções devem ser pequenas, focadas e com headings estáveis.
- Cada seção deve ter contexto suficiente para ser citada isoladamente.
- Termos precisam ser consistentes para melhorar retrieval.
- Limitações, pré-requisitos e exceções precisam ser explícitos.
- Evitar frases vagas ou promocionais, porque a IA pode repeti-las como se fossem instruções.
- Incluir perguntas comuns e respostas canônicas quando possível.

### Estrutura AI-friendly por página

Cada página importante deve responder:

| Pergunta | Por que importa |
|---|---|
| What is it? | Ajuda iniciante e AI a definir o conceito sem inventar. |
| When should I use it? | Ajuda decisão e recomendação. |
| How do I use it? | Dá caminho prático para usuário self-service. |
| What can go wrong? | Alimenta troubleshooting e respostas de suporte. |
| What are the limits? | Evita promessas erradas em respostas da IA. |
| What should I read next? | Ajuda navegação humana e AI follow-up. |

### Índice para Montte AI

Além do conteúdo renderizado pela landing, manter um índice legível por agentes:

```text
docs/llms.txt
```

Fase futura opcional:

```text
docs/ai-docs-index.json
```

Formato sugerido:

```json
{
  "pages": [
    {
      "title": "Agents, harnesses, and sessions",
      "route": "/docs/concepts/agents-harness-sessions",
      "source": "apps/landing/src/content/docs/concepts/agents-harness-sessions.mdx",
      "summary": "Explains the lifecycle of agent instances, harnesses, and sessions.",
      "topics": ["agents", "harness", "sessions", "state"],
      "commonQuestions": [
        "What is the difference between a harness and a session?",
        "How do I continue the same conversation?"
      ],
      "lastUpdatedCommit": "<commit-sha>"
    }
  ]
}
```

Esse índice não substitui `/docs`; ele ajuda Montte AI a encontrar a página certa e citar a fonte correta.

## Arquitetura de informação recomendada para `/docs`

### Camada 1 — Getting started

Objetivo: levar o usuário de zero para “rodei meu primeiro agente”.

Rotas:

```text
/docs
/docs/quickstart
/docs/installation
/docs/project-structure
```

Conteúdo:

- o que é Flue em linguagem simples;
- como criar um agente mínimo;
- como rodar com `flue dev` e `flue run`;
- onde ficam `.flue/agents`, `.agents/skills`, `AGENTS.md`.

### Camada 2 — Core concepts

Objetivo: construir modelo mental.

Rotas:

```text
/docs/concepts/agents-harnesses-sessions
/docs/concepts/sandboxes
/docs/concepts/skills-roles-context
/docs/concepts/tasks
/docs/concepts/runtime-targets
```

Conteúdo:

- agent instance vs harness vs session;
- sandbox virtual, local, Cloudflare, remoto;
- skills/roles/context como lógica em Markdown;
- `session.task()` para trabalho focado/paralelo;
- diferenças Node/Cloudflare/CI.

### Camada 3 — Guides

Objetivo: resolver tarefas concretas.

Rotas:

```text
/docs/guides/support-agent
/docs/guides/issue-triage-ci
/docs/guides/coding-agent-remote-sandbox
/docs/guides/mcp-tools
/docs/guides/cloudflare-support-agent
/docs/guides/github-actions-agent
```

Conteúdo:

- receita passo a passo;
- código completo ou quase completo;
- pré-requisitos;
- troubleshooting;
- próximos passos.

### Camada 4 — Reference

Objetivo: responder “qual é a API exata?”.

Rotas:

```text
/docs/reference/runtime
/docs/reference/cli
/docs/reference/cloudflare
/docs/reference/node
/docs/reference/connectors
/docs/reference/provider-settings
```

Conteúdo:

- assinaturas;
- opções;
- defaults;
- runtime support;
- exemplos mínimos;
- erros comuns.

### Camada 5 — Advanced/architecture

Objetivo: ajudar usuários construindo agentes em produção.

Rotas:

```text
/docs/advanced/session-persistence
/docs/advanced/sandbox-strategy
/docs/advanced/security-and-secrets
/docs/advanced/deploying-at-scale
/docs/advanced/mcp-and-external-tools
```

Conteúdo:

- trade-offs;
- segurança;
- estado/persistência;
- performance/custo;
- deploy em ambientes diferentes.

## Template recomendado por página

### Para páginas de conceito

```mdx
# <Concept name>

One-paragraph explanation in plain English.

## Why it matters

Explain the problem this concept solves.

## Quick example

Show the smallest useful example.

## How it works

Explain the mechanism without assuming deep prior knowledge.

## Common mistakes

List confusing parts and how to avoid them.

## Advanced details

Runtime behavior, lifecycle, persistence, limitations, trade-offs.

## Related APIs

Link to reference pages.

## Next steps

Link to guides that use the concept.
```

### Para how-to guides

```mdx
# <Do the task>

Short outcome-focused summary.

## What you'll build

State the final result.

## Before you start

Prerequisites and assumptions.

## Step 1: ...

Numbered steps with code.

## Step 2: ...

Continue until the user gets a working result.

## Troubleshooting

Common errors and fixes.

## How it works

Explain the relevant concepts after the user has seen the result.

## Production notes

Security, deployment, persistence, cost, scaling.

## Next steps
```

### Para reference

```mdx
# <API or command>

Brief description.

## Signature / command

## Parameters / flags

| Name | Type | Default | Description |
|---|---|---|---|

## Returns / output

## Examples

## Runtime support

| Runtime | Supported | Notes |
|---|---|---|

## Errors and edge cases

## Related guides
```

## Regras de estilo para Flue `/docs`

### Voz

- Clear, direct, calm.
- Friendly, but not cute.
- Confident, but not salesy.
- Technical where needed, but never needlessly abstract.

### Linguagem

- Inglês simples para público global.
- Introduzir termos antes de usá-los.
- Preferir frases curtas.
- Evitar idioms, memes e referências culturais.
- Evitar “just”, “simply”, “obviously”, “easy”.
- Evitar hype de landing dentro da doc.

### Estrutura

- Começar com resultado/benefício prático.
- Colocar exemplo cedo.
- Dividir iniciante/intermediário/avançado por seções.
- Usar tabelas para comparação e opções.
- Usar bullets para listas escaneáveis.
- Cada página deve ter próximos passos.

### Código

- Exemplos devem ser copiáveis.
- Preferir exemplos pequenos e completos.
- Não inventar APIs.
- Mostrar imports.
- Mostrar onde o arquivo vive, por exemplo `.flue/agents/hello-world.ts`.
- Marcar runtime target quando importa: Node, Cloudflare, CI, remote sandbox.
- Evitar placeholders vagos; quando precisar, explicar.

## Como balancear leigo e avançado na mesma página

Use esta ordem:

1. **Plain-English intro** — o que é e por que existe.
2. **Tiny working example** — menor coisa útil.
3. **Mental model** — como pensar sobre isso.
4. **Practical variations** — quando usar alternativas.
5. **Advanced mechanics** — lifecycle, state, runtime behavior.
6. **Reference links** — detalhes exatos.

Exemplo para “Harnesses and sessions”:

- Iniciante: “A harness is the configured environment your agent uses to think and act. A session is one conversation inside that environment.”
- Intermediário: mostrar `const harness = await init(...); const session = await harness.session();`.
- Avançado: explicar default harness, named harnesses, session persistence, Cloudflare Durable Objects, Node memory default, `session(threadName)`.

## Regras para docs geradas por IA

O agente `docs-refresh` deve obedecer:

- não publicar contexto interno como `documentation-context.md`;
- não vazar secrets, env values, tokens, URLs privadas ou metadados irrelevantes de CI;
- não inventar APIs, flags, defaults ou runtime behavior;
- se uma informação não está confirmada, omitir ou marcar como desconhecida;
- manter exemplos alinhados ao código real e docs oficiais do repo;
- preservar frontmatter/metadata exigida pela landing;
- evitar reescrever páginas inteiras quando só uma seção mudou;
- incluir camadas iniciante + avançado nas páginas principais;
- escrever seções chunkáveis, com headings específicos e contexto suficiente para Montte AI usar em respostas;
- incluir limitações, pré-requisitos e troubleshooting quando existirem;
- manter reference mais precisa que narrativa;
- atualizar `docs/llms.txt` junto com o conteúdo público;
- rodar build/typecheck da landing antes de abrir PR.

## Checklist de review humano

Antes de mergear PR de docs:

- [ ] A página ajuda um iniciante a entender o conceito?
- [ ] Um usuário consegue resolver a tarefa sem pedir suporte?
- [ ] Existe um exemplo copiável cedo na página?
- [ ] As APIs/comandos existem de verdade?
- [ ] O texto diferencia Node, Cloudflare, CI e sandbox remoto quando necessário?
- [ ] A seção avançada explica trade-offs reais?
- [ ] Limitações, pré-requisitos e erros comuns estão explícitos?
- [ ] Montte AI poderia citar esta seção sem enganar o usuário?
- [ ] Headings são estáveis, específicos e bons para retrieval?
- [ ] Não há secrets, dados internos ou contexto de CI publicado?
- [ ] Links e rotas funcionam?
- [ ] `docs/llms.txt` aponta para a página correta?
- [ ] O build da landing passou?
- [ ] O texto não parece marketing ou hype?
- [ ] O próximo passo está claro?

## Como isso entra no `docs-refresh`

O agente semanal deve receber essa estratégia como referência obrigatória.

Contrato sugerido:

```text
Read:
- docs/research/user-facing-technical-docs-strategy.md
- .agents/skills/docs/SKILL.md
- documentation-context.md

Write only public docs content consumed by landing /docs and docs/llms.txt.
Every page must serve beginners first, advanced users by the end, and Montte AI retrieval safely.
```

O workflow deve validar:

```bash
git diff --check -- apps/landing docs .agents .flue
bun run landing:build
```

## Decisão recomendada

Para Flue, `/docs` deve seguir um modelo híbrido:

- **Diátaxis na navegação**: tutorials, guides, concepts/explanations, reference.
- **Progressive disclosure dentro das páginas**: simples primeiro, técnico depois.
- **Docs as code no processo**: PR, review, build e versionamento.
- **AI-readable by design**: headings estáveis, seções focadas, limitações explícitas e `docs/llms.txt`.
- **AI-assisted, not AI-published**: agente gera atualização, humano revisa.

Isso cria docs que vendem confiança sem virar marketing, ajudam iniciantes sem esconder complexidade, continuam úteis quando o usuário chega em produção e dão ao Montte AI uma base segura para responder dúvidas.
