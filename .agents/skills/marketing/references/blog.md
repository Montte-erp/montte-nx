# Blog - escrita, distribuição, voz canônica Montte

Esta reference é a **fonte canônica de voz Montte** para todos os canais. LinkedIn, X e blog herdam voz, regras de humanização e regras de pt-BR daqui. Quando `linkedin.md` ou `x.md` silenciarem sobre voz, vale a regra deste arquivo.

Posts vivem em `apps/landing/src/content/blog/<slug>.md` (Astro content collection definida em `apps/landing/src/content.config.ts`). Renderização em `apps/landing/src/pages/blog/[...slug].astro`.

A regra de ouro: **o texto tem que soar como se um humano cansado tivesse escrito num café, não como se um LLM tivesse gerado num pipeline**. As regras abaixo existem pra reforçar isso.

---

## Quick start (blog post novo)

1. Identifique o tipo: **release**, **feature-launch**, **postmortem**, **opinião**, **deep-tech**, **community**.
2. Escolha template (abaixo). Não misture.
3. Escreva H1 igual ao título do frontmatter, não duplique no corpo (renderer já gera).
4. Lede em 1ª frase clara. Sem "Estamos animados...", "No mundo acelerado...", "Hoje viemos compartilhar...".
5. 3 a 6 H2. Última H2 quase sempre vira "O que vem por aí" ou CTA equivalente.
6. Cada afirmação técnica leva número, link, ou nome próprio.
7. Parágrafos de 2 a 4 frases. Uma ideia por parágrafo.
8. CTA final em 1 linha, atalho, link, waitlist.
9. Preencha frontmatter completo (ver "Frontmatter" abaixo).
10. Rode o checklist final + o **teste do humano** (final deste arquivo).
11. **Planeje a distribuição** antes de publicar (seção "Cadeia de distribuição" no final).

---

## Voz

| Faça | Não faça |
|------|----------|
| "Você abre o Montte e..." | "Os usuários têm acesso a..." |
| "Nós erramos o deploy." | "Houve um incidente." |
| "30% mais rápido, medimos em 2,3s indo pra 1,6s." | "Significativamente mais rápido." |
| "No Montte, a tabela..." | "Na nossa plataforma de ERP..." |
| "Não funcionou. Refizemos." | "Após exaustiva análise, optamos por refatorar." |
| Humor seco ocasional, emoji raro (🤦, 🎉 só em momento real) | Emoji decorativo em headline |
| Citar pessoa real (Manoel, dev externo, cliente João da Padaria) | "Um membro da comunidade" |
| "A gente perdeu duas tardes nisso." | "Investimos esforço significativo nesta tarefa." |

**Pronomes:** "nós/a gente" como padrão de equipe Montte. "eu" só em post de opinião assinado por um autor. "você" direto pro leitor.

**Marca:** Montte é masculino. Nome do produto é só "Montte" em copy public-facing, nunca "Montte Payments", "Montte ERP", "Montte CRM" ou qualquer sufixo (vertical interna pode aparecer no Linear, nunca no blog/landing/social). Bling, Omie e Conta Azul só entram como referência negativa seca ("Não é Bling, Omie ou Conta Azul."), nunca como ataque ou comparação de feature. Cite Asaas, Stripe, Mercado Pago e Abacate Pay como gateways de referência. Tags chamam-se "Centro de Custo".

---

## Posicionamento canônico

A frase-régua que vale pra todo canal Montte: **camada de billing pra SaaS de um jeito que o founder não precise de ERP**.

Tagline public oficial: **a camada que falta no SaaS brasileiro pra facilitar a vida do founder**. Essa é a forma que entra em description de blog, hook, landing. Use literalmente, sem reinventar.

### Mental model interno (NÃO usar em copy public)

Montte é mistura de **Autumn + Rillet**. Vocabulário pra alinhamento interno, jamais em texto pro leitor:

- **Lado Autumn (dev-facing billing layer):** Customer como primitiva de cobrança por uso, SDK, `customers.state` agregando assinatura/uso/fatura/status numa chamada. Plugar em qualquer SaaS substitui o trabalho de wirear Stripe Billing, Lago, Orb ou planilha caseira.
- **Lado Rillet (founder/ops-facing financial intelligence):** contabilidade e financeiro AI-native - auto-categorização, conciliação, dashboards. Substitui o reflexo de comprar Omie/Bling/Conta Azul.

Junto fecha o ciclo: cobra, mede, fatura, concilia, mostra saúde financeira, **sem ERP separado**. Quando der dúvida de escopo num post, a régua é: ou serve o dev integrando billing, ou serve o founder olhando financeiro com IA. Fora disso é Twenty (CRM), Abacate Pay (gateway), ou NFe - não core do Montte.

### O que dizer (frases canônicas)

| Tema | Forma canônica |
|------|----------------|
| O que é o Montte | "Camada de billing que falta no SaaS brasileiro." |
| Posicionamento amplo | "A camada que falta no SaaS brasileiro pra facilitar a vida do founder." |
| Promessa pro founder | "Cobrança, uso, fatura e estado do cliente sem precisar montar um ERP por fora." |
| Customer | "Primitiva de cobrança por uso." (não "primitive", não "objeto de billing") |
| API central | "`customers.state` devolve assinatura, uso, fatura e status numa chamada." |
| CRM | "Twenty é a primeira integração porque o Montte usa o Twenty internamente." |
| Pagamento | "Abacate Pay vai entrar como primeiro adapter." |
| Não-concorrência | "Não é Bling, Omie ou Conta Azul." (afirmação seca, sem "estamos tentando ser") |

### O que NÃO dizer (frases banidas)

| Não use | Por quê |
|---------|---------|
| "Montte Payments", "Montte CRM", "Montte ERP" | Produto é só Montte. Sufixos confundem posicionamento |
| "Runtime de billing" | Termo técnico que afasta founder. Usar "camada" |
| "ERP simples", "ERP nacional", "ERP brasileiro" | Montte não é ERP - a frase canônica é literalmente "sem ERP" |
| "Plataforma operacional completa" | Genérico, soa institucional. Usar a tagline |
| "Infraestrutura de pagamentos" | Falso - Montte é camada de billing, gateway entra como adapter |
| "Stack de billing", "stack de finanças" | Anglicismo + vago |
| "Solução all-in-one" | Pitch de SaaS dos anos 2010 |
| "Founder-friendly", "developer-first" | Anglicismo de pitch. Mostre, não rotule |
| "Não estamos tentando ser X" | Eco desnecessário depois de "não somos X". Afirmação seca já basta |
| "Facilitamos a vida de empresas brasileiras" | Soft, vazio. A tagline tem alvo (founder) e domínio (SaaS) - use ela |

### Hierarquia de menção em copy public

- ✅ Twenty: única integração de CRM citável. É a primeira porque Montte usa internamente.
- ✅ Abacate Pay: primeiro adapter de pagamento. Pode citar em escopo de billing.
- ⚠️ DocuSeal: assinatura digital, self-hosted. Citável só quando o tema for documentos.
- ❌ Bling, Omie, Conta Azul: só como referência negativa seca ("Não é Bling, Omie ou Conta Azul."), nunca ataque ou comparação de feature.
- ❌ Pipedrive, HubSpot, Salesforce: não citar como integração - Twenty é o único CRM no roadmap.
- ❌ Autumn, Rillet, Polar, Stripe Billing, Lago, Orb: aparecem em survey/contexto técnico, nunca como comparação direta em headline. Em texto pode citar como "o que tem hoje no mercado lá fora" sem virar tese.
- ❌ Mastra, Vercel AI SDK, `@packages/agents`: não existem no Montte. Não mencionar.

### Vocabulário operacional

- "Customer" (em código e em texto técnico) ≠ "Cliente" (em copy founder-facing). Use cada um no contexto certo.
- "Cobrança por uso" >> "usage-based billing" em copy pt-BR.
- "Adapter de pagamento" ok (termo técnico consolidado). "Adaptador de pagamento" também aceitável.
- "Plano", "assinatura", "fatura", "uso medido", "status de pagamento" - léxico estável.
- "Centro de Custo" sempre que aparecer o que outros chamam de "tag".
- "Build in public" pode aparecer; "transparência radical" não.
- Quando NFe vier: "emissão própria, sem SaaS", não "solução de NFe integrada".

---

## Humanização (a parte mais importante)

LLMs deixam pegadas. Detectores como GPTZero, Originality.ai e Copyleaks atrás de cinco padrões: travessões em excesso, ritmo de frase uniforme, vocabulário previsível, listas de três itens em loop, e fechamentos formais. As regras abaixo neutralizam essas pegadas e ainda melhoram a leitura.

### 1. Travessão longo está banido

O em dash (U+2014) virou marca registrada de texto gerado por IA. Em pt-BR brasileiro, ele é raro fora de literatura e diálogos. **Não use em nenhum canal Montte (blog, LinkedIn, X).** Substitua por uma destas quatro opções, na ordem de preferência:

1. **Vírgula**: "A tabela virou um extrato, agora com subtotal inline."
2. **Ponto** (quebrar em duas frases): "A tabela virou um extrato. Subtotal aparece inline."
3. **Parênteses**: "A tabela virou um extrato (com subtotal inline)."
4. **Dois pontos**: "A tabela tem um truque novo: subtotal inline."

Hífen `-` está ok em listas markdown (`- item`) e em palavras compostas ("conta-corrente"). Em dash (U+2014) e en dash (U+2013), zero. Se o linter inserir, remova.

### 2. Anglicismos: traduza ou justifique

Anglicismos vazam quando o texto foi pensado em inglês primeiro. Evite. Tabela de tradução obrigatória:

| Não use | Use |
|---------|-----|
| "deployar", "deploy" (verbo) | "publicar", "subir pra produção", "fazer release" |
| "feature" | "funcionalidade", "recurso" (em copy user-facing). "feature" pode ficar em deep tech. |
| "performance" | "desempenho" |
| "task" | "tarefa" |
| "bug" | "bug" está ok (já é universal), mas "falha", "erro", "regressão" funcionam |
| "workflow" | "fluxo de trabalho", "fluxo" |
| "framework" | "framework" ok em deep tech, "estrutura" em copy geral |
| "dashboard" | "painel" |
| "stakeholder" | "parte interessada", "time", "área" |
| "key takeaway" | "ponto principal" |
| "case" | "caso", "exemplo" |
| "insight" | "descoberta", "observação", "achado" |
| "pipeline" | "fluxo", "esteira", "pipeline" só em deep tech |
| "release" | "release" ok como termo técnico, mas "atualização" e "versão" também servem |
| "build" | "build" ok em deep tech, "compilação" em copy geral |
| "checkout" | "checkout" ok (e-commerce universal), "finalizar compra" alternativo |
| "onboarding" | "primeira experiência", "configuração inicial", "boas-vindas" |
| "feedback" | "feedback" ok (consolidado), "retorno", "opinião" alternativas |
| "review" | "revisão" |
| "ship" (verbo) | "entregar", "lançar", "subir" |
| "trade-off" | "troca", "concessão" |
| "edge case" | "caso extremo", "borda" |
| "boilerplate" | "código repetitivo", "esqueleto" |
| "boas práticas" antes de "best practices" | usar "boas práticas" diretamente |

Quando o termo técnico não tem tradução boa (oRPC, TanStack, Drizzle), use o termo. Quando tem tradução comum (deployar → publicar), traduza.

### 3. Burstiness: varie comprimento de frase

LLMs escrevem frases de comprimento parecido. Humano não. Misture:

- **Curta** (3 a 8 palavras): "Não funcionou. Refizemos."
- **Média** (10 a 20 palavras): "A tabela ganhou agrupamento por data e categoria, com subtotal inline em cada linha."
- **Longa** (25 a 40 palavras, ocasional): "Antes dessa release, ver o fluxo de caixa do dia exigia filtro manual, export pra planilha, e dois minutos perdidos por tarefa, o que num mês de fechamento somava horas que ninguém tinha."

Padrão saudável: **curta-longa-média**, ou **média-curta-longa**. Evite três médias seguidas. Frase muito curta funciona como soco, use ao menos uma vez por seção.

### 4. Perplexidade lexical: não repita o sinônimo óbvio

LLMs viciam em variantes próximas ("rápido, ágil, veloz, eficiente"). Humano repete a palavra ou inventa imagem. Estratégias:

- **Repita a palavra** em vez de buscar sinônimo. "A tabela é rápida. A tabela é rápida porque..." soa mais humano que "A tabela é veloz. A tabela é ágil porque...".
- **Use imagem concreta** em vez de adjetivo: "Carrega antes do café esfriar" em vez de "extremamente rápido".
- **Cite tempo, número, marca**: "carrega em 200ms", "300 linhas por segundo", "do tamanho de um post no LinkedIn".

### 5. Quebre o tique da lista de três

LLMs adoram "X, Y e Z". Reais: 2 itens, 4 itens, 5 itens, lista numerada, ou prosa sem lista. Misture. Se uma seção já tem bullet de 3, na próxima fuja de 3. Releases que listam 8 features podem agrupar em 2 + 3 + 3, ou em 4 + 4, etc.

### 6. Bote uma falha pessoal em pelo menos um parágrafo

Texto humano tem cicatriz: "Tentamos primeiro com X, deu ruim, voltamos pra Y." "Levou duas tentativas pra acertar." "Achei que era simples, não era." Quando o post é release/feature, ache 1 momento real onde algo não funcionou de primeira e mencione em 1 frase.

### 7. Detalhe específico no lugar de adjetivo

| Vago | Concreto |
|------|----------|
| "Muito rápido" | "Carrega 4 vezes mais rápido, de 2s pra 500ms" |
| "Vários clientes" | "12 clientes do lote beta" |
| "Recentemente" | "Na sexta passada, 09 de maio" |
| "Equipe pequena" | "Três pessoas: eu, Lucas e Bia" |
| "Muito tempo" | "Quatro horas" |
| "Grande melhoria" | "30% menos cliques no fluxo de criar lançamento" |

### 8. Fechamento: não despedir

Frases tipo "Em conclusão", "Por fim", "Para finalizar", "Resumindo, o Montte oferece..." são marca de LLM. **Apenas pare.** Última frase é a última frase. Se quiser fechar com algo, use ação concreta: "Entra na waitlist", "Manda DM se quiser testar", "PR está aberto pra revisão".

### 9. AI-tells em pt-BR (banidos por padrão)

| Frase suspeita | Motivo |
|----------------|--------|
| "No mundo acelerado de hoje..." | Abertura genérica de blog 2018 |
| "Em um cenário cada vez mais competitivo..." | Idem |
| "É importante notar que..." | Hedging sem valor |
| "Vale ressaltar que..." | Idem |
| "Cabe destacar..." | Idem |
| "Ademais", "Outrossim", "Destarte" | Formalismo de redação ENEM |
| "Em suma", "Em síntese" | Fechamento de redação |
| "Por outro lado" (usado mais de 1 vez) | Tique de comparação balanceada |
| "Por sua vez" | Idem |
| "Não apenas X, mas também Y" | Estrutura LLM clássica |
| "É inegável que..." | Hedge confiante falso |
| "Inegavelmente", "indubitavelmente" | Idem |
| "No que diz respeito a..." | Construção pesada |
| "No tocante a..." | Idem |
| "Dito isso..." (mais de 1 vez no texto) | Transição muleta |
| "Vamos mergulhar fundo em..." | Tradução literal de "dive deep" |
| "Desvendar", "desbravar" | Dramatização inútil |
| "Jornada" como metáfora de processo | Salesman speak |
| "Empoderar", "empoderado" | Empresário de coach |
| "Sinergia" | Consultoria 2005 |
| "Robusto", "poderoso", "elegante" como adjetivo de produto | Vago |
| "Game-changer", "next-level", "best-in-class" | Anglicismo + vago |

**Detector de AI roda nessas frases.** Se uma escapar, ok. Duas, suspeito. Três, o texto cheira.

### 10. Pontuação humana em pt-BR

- **Vírgula serial (Oxford comma)**: em pt-BR é **opcional**. Padrão Montte: **não** usa vírgula antes do "e" final ("contas, cartões e categorias"), exceto pra resolver ambiguidade.
- **Reticências (`...`)**: ok em fala ou suspense. Não em texto técnico.
- **Aspas**: prefira `"` (duplas retas). Aspas tipográficas (`"` `"`) são ok mas inconsistentes; deixe o renderer escolher.
- **Parênteses**: bom pra contexto rápido, ruim em cascata. Máximo 1 par por parágrafo.
- **Negrito**: só em termo de bullet (`- **Nome:**`) ou nome de feature. Não em frase corrida.
- **Itálico**: nome de produto externo (Asaas, Stripe), ou ênfase rara.

### 11. Voz ativa em pt-BR

| Passiva (evite) | Ativa (use) |
|-----------------|-------------|
| "A tabela foi reescrita." | "Reescrevemos a tabela." |
| "Foi adicionado suporte a X." | "Adicionamos suporte a X." |
| "A funcionalidade pode ser acessada via menu." | "Você acessa pelo menu." |
| "Bugs foram corrigidos." | "Corrigimos bugs." |

Passiva sintética com "se" ("realizou-se", "implementou-se") é ainda pior. Só fica em texto jurídico, nunca em blog Montte.

---

## Templates por tipo

### Release notes (`category: "Notas de release"`)

```
[1 parágrafo lede: tema da release em 2 a 3 frases]

## [Feature mais impactante]
[2 parágrafos: o que mudou, por que importa]

## [Feature 2]
## [Feature 3]
## Ação necessária  (se houver breaking change)
## Outras melhorias
- **[nome]:** [1 linha]
- ...
## Correções
[1 parágrafo corrido ou bullets curtos]
## Bastidores  (opcional, só se mudou stack ou infra interessante)
```

### Feature launch

```
[Lede: "O Montte agora [verbo presente]." 1 frase forte + 1 de contexto]

## [Pilar 1 do problema/solução]
## [Pilar 2]
## [Pilar 3]
## Por baixo do capô  (opcional, técnico)
## O que vem por aí
[1 parágrafo + atalho/CTA em 1 linha]
```

### Postmortem

```
[1 frase admitindo o problema direto. Sem rodeios.]

## Como aconteceu
## Como não percebemos antes
## O que já fizemos
## O que vamos fazer
```

Ownership em voz ativa. "Erramos", "deixamos passar", "vamos corrigir". Nunca "houve um problema".

### Opinião (assinado por 1 pessoa)

```
[Lede: contexto pessoal ou concern do mercado que vai rebater]

## [Anti-tese / concern]
## [Counter]
## [Reframe / visão Montte]
## O que vem por aí
```

### Deep tech

```
[Lede narrativo: começou com bug, usuário, ou medição real]

## [Problema concreto]
## [Solução técnica, com código]
## [Resultado, com número]
## Apêndice  (opcional, se descobriu algo depois)
```

### Community / spotlight

```
[Lede: nome da pessoa + 1 contribuição concreta]

## [Como conheceram o Montte]
## [O que construíram]
## [Próximos passos da pessoa/projeto]
```

---

## Frontmatter (obrigatório)

Schema atual em `apps/landing/src/content.config.ts`. Preencha **todos** os campos, inclusive os opcionais quando aplicáveis, eles alimentam SEO/AEO/GEO.

```yaml
---
title: "Título declarativo curto, até 60 chars"
description: "40 a 60 palavras. Resposta direta ao que o post entrega. Primeira frase serve como TL;DR usado por AI overviews."
publishedAt: 2026-MM-DD
updatedAt: 2026-MM-DD   # adicione quando reeditar substancialmente
author: "Nome Real"     # mapeado em apps/landing/src/data/authors.ts
tags: ["release", "financeiro"]   # 2 a 4 tags, kebab-case lowercase
category: "Notas de release"      # ou "Feature", "Postmortem", "Opinião", "Engenharia", "Comunidade"
coverImage: "../../assets/blog/<slug>.jpg"   # 1200x630, WebP/JPG
ogImage: "../../assets/blog/<slug>-og.jpg"   # 1200x630 dedicada se diferente da cover
featured: false
releaseUrl: "https://github.com/Montte-erp/montte-nx/releases/tag/vYYYY.MM.DD"
releaseVersion: "vYYYY.MM.DD"
keyTakeaways:                                 # 3 a 5 bullets, usado em llms.txt e summary
   - "..."
faq:                                          # opcional, gera FAQPage JSON-LD
   - question: "..."
     answer: "..."
readingMinutes: 4                             # estimado
canonicalUrl: ""                              # só se canonical externo
---
```

### Regras do `title`
- Verbo no presente quando possível.
- Até 60 caracteres pra caber em SERP.
- Sem emoji, sem travessão, sem "Como" se puder evitar.
- Bom: "Lançamentos agrupados e logos de banco chegaram"
- Ruim: "🚀 Anunciando: as novas funcionalidades incríveis da última atualização!"

### Regras do `description`
- 40 a 60 palavras (160 a 320 chars). Esse range é o sweet spot pra Google + AI overviews.
- Primeira frase é resposta literal pra "o que esse post entrega?". É essa que ChatGPT/Perplexity citam.
- Densidade de fato alta, números, nomes de features, verbos concretos.
- Sem "neste post você vai aprender". Vá direto.
- Sem travessão.
- **Dupla função:** essa string também vira `og:description` no preview do LinkedIn/X. Escreva pensando em preview social além de SERP.

### Slug do arquivo
- `montte-YYYY-MM-DD.md` pra release.
- `<kebab-resumo>.md` pra outros (ex.: `por-que-llms-nao-constroem-software.md`).
- Match `<slug>` em `[...slug].astro`.

---

## Estrutura de conteúdo

**Headings:**
- H1 vem do frontmatter, não escreva no markdown.
- H2 marca seções principais (3 a 6 no total). Use sentence case: "Por baixo do capô", não "Por Baixo Do Capô".
- H3 só dentro de seção longa. Evite H4+.
- Primeiro H2 é índice TOC sidebar (renderer filtra `depth === 2`).

**Parágrafos:**
- 2 a 4 frases. Quebre antes de virar bloco denso.
- Misture frase curta (5 a 10 palavras) com composta (20 a 30), ritmo (ver Burstiness acima).
- Cada parágrafo carrega uma ideia. Se carrega duas, divida.

**Listas:**
- Bullet `-` com bold no termo: `- **Nome da feature:** descrição em 1 linha.`
- Lista numerada só quando a ordem importa.
- Não bullet de 1 item. Não 15 bullets seguidos, quebre em sub-headings.
- Quebre o vício de 3 itens (ver Humanização §5).

**Código:**
- Use ``` com linguagem (`tsx`, `bash`, `sql`).
- Snippet até 15 linhas. Acima disso, link pro arquivo no repo.
- Não cole config inteira, só o trecho que importa.

**Links:**
- Internos pra docs/features do Montte.
- Externos pra fontes (sempre cite, AEO valoriza).
- Texto descritivo, nunca "clique aqui" nem "aqui".

**Imagens:**
- Cover 1200x630 em `apps/landing/src/assets/blog/`.
- Screenshots inline com alt descritivo, não "screenshot", mas "Lista de lançamentos agrupada por categoria mostrando subtotais inline".
- Astro `<Picture>` faz otimização, confie nele.

---

## SEO / AEO / GEO

**SEO clássico:** title até 60 chars, description 40 a 60 palavras, H1 único (renderer), heading hierarchy limpa, canonical (layout já gera), sitemap auto (`@astrojs/sitemap` ativo).

**AEO (Answer Engine Optimization):** IAs citam conteúdo que responde literal. Pra cada H2, primeira frase é resposta direta à pergunta implícita do heading. Adicione `faq:` no frontmatter quando o post tem 2 ou mais perguntas que usuários fazem, vira `FAQPage` JSON-LD (citation rate 4,2x maior que markdown puro).

**GEO (Generative Engine Optimization):** IAs ranqueiam densidade de fato. Cada afirmação técnica leva número, nome ou link. Adicione `keyTakeaways` no frontmatter (3 a 5 bullets), esses bullets viram seção TL;DR no topo do post e entram no `llms.txt`. Atualize `updatedAt` em reedições substanciais, frescor é sinal forte pra LLMs.

**llms.txt:** mantenha `apps/landing/public/llms.txt` com lista de posts em markdown. LLMs leem direto sem parsear JS. Cada post nessa lista: `- [Título](url): description (40 a 60 palavras)`.

**Schema.org no `[...slug].astro`:** o layout emite `BlogPosting` JSON-LD com `headline`, `description`, `image`, `datePublished`, `dateModified`, `author`, `publisher`, `mainEntityOfPage`. Quando `faq` existe no frontmatter, emite `FAQPage` adicional.

---

## Convenções pt-BR

- "Montte" é nome próprio masculino. "**no** Montte", "**do** Montte", nunca "na Montte".
- "Lançamento" é transação financeira, não release de software. Pra release de produto: "release" ou "atualização".
- Decimais com vírgula: "2,3s", "R$ 1.500,00".
- Datas: "15 de maio de 2026" em corpo; ISO no frontmatter.
- "Centro de Custo" sempre, nunca "tag" em copy user-facing.
- "Você" e não "tu" / "vocês".
- "A gente" é coloquial e ok em opinião/founder posts. "Nós" em release/feature.
- "Pra" e "pro" são ok em prosa (contração coloquial brasileira). "Para o" só se quiser sair mais formal.
- "Tá" em vez de "está" só em opinião casual, nunca em release.
- Crase: "às 14h", "à medida que", "à toa". Confira ferramentas de revisão antes de publicar.

---

## Checklist antes de commitar

- [ ] Título até 60 chars, sem emoji, sem travessão, verbo no presente
- [ ] Description 40 a 60 palavras, 1ª frase é o TL;DR
- [ ] Frontmatter completo (incluindo `keyTakeaways` e `faq` quando aplicável)
- [ ] H1 não está no markdown (vem do frontmatter)
- [ ] 3 a 6 H2, última é CTA ou "O que vem por aí"
- [ ] Cada afirmação técnica leva número, nome ou link
- [ ] Nenhuma frase começa com "Estamos animados", "Hoje viemos...", "No mundo acelerado..."
- [ ] "no Montte" / "do Montte", nunca "na Montte"
- [ ] Cover image 1200x630 existe em `apps/landing/src/assets/blog/`
- [ ] Slug do arquivo bate com convenção
- [ ] Bullets com bold no termo
- [ ] CTA final em 1 linha
- [ ] `bun run landing:build` passa local
- [ ] **Plano de distribuição definido** (LinkedIn + X - ver seção abaixo)

### Teste do humano (passe os 8)

- [ ] **Zero em dash (U+2014) ou en dash (U+2013)** no texto. Apenas hífens (`-`) e pontuação comum.
- [ ] **Zero anglicismos evitáveis**. Rodei a tabela "Não use / Use" mentalmente.
- [ ] **Ritmo varia**: tenho frase curta de até 8 palavras em pelo menos 1 das primeiras 3 seções.
- [ ] **Nenhuma sequência de 3 frases médias seguidas** sem quebra.
- [ ] **Pelo menos 1 detalhe específico real** (tempo, número, nome) por seção H2.
- [ ] **1 momento de imperfeição/cicatriz** no post inteiro (algo que não funcionou de primeira).
- [ ] **Nenhuma frase da lista de AI-tells pt-BR** (§9 da Humanização).
- [ ] **O post termina sem despedida formal**. Última frase é ação ou afirmação, não "Em conclusão...".

---

## Anti-padrões (rejeitar imediato)

- "Neste post, vamos explorar..."
- "Como você sabe..."
- "É importante notar que..."
- "Em resumo,..." (use só se obrigatório)
- "Estamos animados em anunciar..."
- "Vamos mergulhar fundo..."
- "Desbravar", "desvendar", "jornada" (como metáfora vaga)
- Adjetivos vagos: incrível, revolucionário, único, poderoso, robusto, elegante
- Bullet de 1 frase repetindo o título do bullet
- H2 numerado ("1. Primeira feature"), use markdown ol se ordem importa
- Listar 20 features sem agrupar
- Screenshots sem alt text
- Link com texto "aqui" ou "este link"
- Promessa de roadmap sem data ("em breve" só com contexto)
- Em dash (U+2014) ou en dash (U+2013) em qualquer posição
- Anglicismo gratuito quando há tradução pt-BR direta
- Frase final do tipo "E é isso!", "Espero que tenha gostado", "Até a próxima"
- Três bullets quando o conteúdo natural pediria 2 ou 4

---

## Pipeline de revisão

1. **Escreve o rascunho** seguindo o template.
2. **Passa o "ctrl+F" do travessão**: busca em dash (U+2014) e en dash (U+2013) no arquivo, troca todos por vírgula, ponto, parênteses ou dois pontos.
3. **Passa o "ctrl+F" dos anglicismos**: busca cada palavra da tabela §2 da Humanização.
4. **Lê em voz alta**. Se travou na leitura, reescreve a frase.
5. **Confere ritmo**: se 3 frases seguidas têm o mesmo tamanho, quebra uma em duas ou junta duas em uma.
6. **Roda checklist + teste do humano**.
7. **Roda `bun run landing:build`** pra validar schema.
8. **Commita** com mensagem curta.
9. **Planeja a distribuição** (próxima seção).

---

## Blog como canônico (distribuição)

LinkedIn e X são canais **derivados**. O conteúdo de verdade vive em `apps/landing/src/content/blog/<slug>.md`. Razões:

- **SEO/AEO/GEO ficam no blog.** LinkedIn não indexa pra Google; X bloqueia indexação parcial. Tráfego orgânico de longo prazo é do blog.
- **Permanência.** Post no LinkedIn some do feed em 48h. Post no blog tem URL estável, citável, linkável.
- **Edição.** Reescrever o blog é commit + redeploy. Reescrever post no X = deletar e republicar (custa reach).
- **Atribuição.** Blog post = traffic source mensurável no PostHog. LinkedIn/X = referrer perdido depois de 24h.

Regra prática: **escreve no blog primeiro, depois repurpose**. Nunca o inverso. Se a ideia vai virar thread X, ainda vale escrever blog post primeiro, o esforço de estruturar argumento longo melhora a thread.

Exceção: tweet atômico ou observação curta (<300 chars). Esses ficam só no X, virar blog post curto é fricção sem upside.

---

## Tipos de post que distribuem bem

Os 4 pillars do `SKILL.md` mapeiam pros 6 tipos de template acima. Nem todo tipo de blog post distribui bem em social:

| Tipo de blog post | Distribuição LinkedIn | Distribuição X | Por quê |
|---|---|---|---|
| **Opinião contrária** ("Removemos o CRM") | Excelente | Excelente | Hook claro, tese controversa, fácil reduzir pra 1 hook line |
| **Postmortem** ("Quebramos a release de sexta") | Bom | Excelente | Vulnerabilidade engaja em ambos; X gosta de timeline de incidente |
| **Build log** ("Como reduzimos 30% do bundle") | Excelente | Bom | LinkedIn ama número específico; X bom só se tiver visual/code |
| **Release notes** ("v2026.05.15") | Médio | Médio | Distribui só se UMA feature dominar a release; senão, é changelog |
| **Feature launch** ("Lançamos X") | Médio | Médio | Risco de soar pitch. Salva se o post foca em PROBLEMA que a feature resolve |
| **Deep tech** ("Por que escolhemos oRPC") | Médio | Bom | LinkedIn aceita se virar carrossel; X funciona em thread densa |
| **Community / users** ("Caso João da Padaria") | Bom | Médio | Nome real engaja LinkedIn; X precisa de twist pra não soar promocional |

Antes de escrever, decide o **par** blog + canal alvo. Se a ideia não renderiza em pelo menos 1 canal social, **provavelmente o blog post também é fraco**, reconsidera a tese.

---

## Cadeia de distribuição (blog → LinkedIn → X)

Fluxo padrão pra um post Montte:

```
1. Blog post canônico       (apps/landing/src/content/blog/<slug>.md)
        ↓
2. LinkedIn texto longo     (re-narração, 900-1.300 chars, hook ≠ do blog)
        ↓ mesmo dia, 30min depois
3. Repost LinkedIn page     (post pessoal + repost no perfil Montte)
        ↓ próximo dia
4. Thread X                 (5-9 tweets, link blog na 1ª reply)
        ↓ 3-5 dias depois
5. Atomic X de followup     (1-2 tweets extraindo o ponto mais polêmico, citando o thread)
        ↓ semana seguinte
6. Comentário em post relacionado de outra pessoa  (linkar blog org. quando fizer sentido)
```

**Regras de timing:**
- Não publique blog + LinkedIn + X **no mesmo minuto**. Os bots de algoritmo penalizam padrão sincronizado.
- LinkedIn ~30min após blog ir no ar, X ~24h depois. Diferença força conteúdo a ter pegada própria em cada canal, não copy-paste.
- Atomic followup só se o blog post viralizou, sem dado de tração, esperar.

**Regra de adaptação:**
O hook do LinkedIn NÃO é igual ao H1 do blog. O hook do X NÃO é igual ao do LinkedIn. Razão: público overlap mas não 100%. Quem viu o LinkedIn não precisa abrir o X. Quem leu o blog não precisa abrir o LinkedIn. Cada canal precisa entregar **algo a mais ou diferente**.

Exemplo, post "Removemos o CRM":
- **Blog H1:** "Removemos o CRM do Montte. Veja por quê."
- **LinkedIn hook (F2 R.I.P.):** "R.I.P. módulo CRM dentro de ERP. Causa da morte: ninguém usava."
- **X hook tweet:** "Todo ERP brasileiro tem CRM nativo. Deletei o nosso. 3.081 linhas, 0 reclamação."

Mesma tese, 3 ângulos.

---

## OG image e preview social

**OG image é decisiva.** Preview cinza de LinkedIn/X mata o clique. Toda blog post pra distribuir precisa de hero image gerada (ferramenta interna de OG do landing já cuida disso: `apps/landing/src/og.ts`).

`description` no frontmatter ≠ lede do post. `description` é meta tag, máximo 320 chars, **escrito pra preview social** além de SERP. Boa description tem 1 stat + 1 promise. Exemplo:

```yaml
description: "Deletamos 3.081 linhas. Aqui está por que removemos o módulo de Contatos."
```

Ruim:
```yaml
description: "Reflexões sobre como o Montte está evoluindo seu approach a CRM."
```

---

## URL e canonical

URL do blog vira link de referência em todos os canais. Regras:

- Slug curto: `removemos-o-crm`, não `removemos-modulo-de-contatos-do-montte-erp`
- Sem data no path (URL precisa sobreviver a edição)
- Canonical sempre `https://montte.com.br/blog/<slug>`, nunca shortener
- UTM em link postado: `?utm_source=linkedin` / `?utm_source=x` (PostHog usa pra atribuição)

---

## Quando o blog NÃO é a origem

Casos onde social vem primeiro e blog segue (ou não existe):

- **Hot take reativo:** comentário sobre release de concorrente, evento da indústria que precisa post no mesmo dia. Vai pro X direto. Se virar thread densa, depois consolida em blog post.
- **Observação atômica:** frase de 1 linha que só funciona como tweet. Não vira blog.
- **Resposta a cliente / comunidade:** pergunta específica respondida em LinkedIn ou X. Pode virar blog FAQ depois se repetir.

Nesses casos, ainda vale registrar a ideia em `apps/landing/content/blog/_drafts/` se tiver potencial de blog post longo no futuro.

---

## Anti-padrões de distribuição

- Blog post publicado SEM repurpose social (perdeu reach de 0 esforço extra)
- Repurpose copy-paste idêntico em todos os canais
- Linkar blog post sem OG image (preview cinza = morte)
- Publicar blog + LinkedIn + X no mesmo minuto (algo penaliza padrão)
- Mais de 1 link no corpo do post LinkedIn (vai pro 1º comentário)
- Repurpose de release notes inteira em formato thread (chato, vira changelog visual)
- Tradução literal do hook entre canais (cada canal tem ritmo próprio)

---

## Referências externas

- Estilo base: blog do Zed (`zed.dev/blog`), confiança calma, número-pesado, autor real
- GEO 2026: Search Engine Land guide a [mastering generative engine optimization](https://searchengineland.com/mastering-generative-engine-optimization-in-2026-full-guide-469142)
- AEO schema stack: [AirOps](https://www.airops.com/blog/schema-markup-aeo), [Frase FAQ schema](https://www.frase.io/blog/faq-schema-ai-search-geo-aeo)
- llms.txt: [Andrew Coyle](https://www.andrewcoyle.com/blog/generative-engine-optimization-and-the-llms-txt-file)
- Astro SEO 2026: [Neciu Dan checklist](https://neciudan.dev/astro-seo-checklist-2026), [Joost guide](https://joost.blog/astro-seo-complete-guide/)
- Copywriting base: [coreyhaines31/marketingskills copywriting](https://github.com/coreyhaines31/marketingskills), princípios "clarity over cleverness", "specific over vague", "show over tell"
