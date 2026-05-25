# Blog - formato, frontmatter e distribuição

Esta reference cobre o que é específico de blog: templates, frontmatter, SEO/AEO/GEO, estrutura e cadeia de distribuição. Voz, posicionamento, regras de humanização e convenções pt-BR vivem em [`writing.md`](writing.md). Quando houver conflito, `writing.md` vence para escrita e este arquivo vence para formato de blog.

Posts vivem em `apps/landing/src/content/blog/<slug>.md` (Astro content collection definida em `apps/landing/src/content.config.ts`). Renderização em `apps/landing/src/pages/blog/[...slug].astro`.

Abra [`writing.md`](writing.md) antes deste arquivo. A regra de ouro, voz, posicionamento e anti-padrões vivem lá.

---

## Quick start (blog post novo)

1. Abra [`writing.md`](writing.md) para fixar voz, posicionamento e anti-padrões.
2. Identifique o tipo: **release**, **feature-launch**, **postmortem**, **opinião**, **deep-tech**, **community**.
3. Escolha template (abaixo). Não misture.
4. Escreva H1 igual ao título do frontmatter, não duplique no corpo (renderer já gera).
5. Lede em 1ª frase clara. Sem "Estamos animados...", "No mundo acelerado...", "Hoje viemos compartilhar...".
6. 3 a 6 H2. Última H2 quase sempre vira "O que vem por aí" ou CTA equivalente.
7. Cada afirmação técnica leva número, link, ou nome próprio.
8. Parágrafos de 2 a 4 frases. Uma ideia por parágrafo.
9. CTA final em 1 linha, atalho, link, waitlist.
10. Preencha frontmatter completo (ver "Frontmatter" abaixo).
11. Rode checklist final de `writing.md` + checklist de blog abaixo + [`stop-slop.md`](stop-slop.md).
12. **Planeje a distribuição** antes de publicar (seção "Cadeia de distribuição" no final).

---

## Voz, posicionamento e humanização

Regras canônicas de escrita vivem em [`writing.md`](writing.md). Antes de escrever blog, abra esse arquivo para voz Montte, posicionamento, pt-BR, anti-padrões e checklist final.

Este arquivo só adiciona regras específicas de blog: template, frontmatter, SEO/AEO/GEO, estrutura e distribuição. Depois do checklist de escrita, rode também [`stop-slop.md`](stop-slop.md).

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
- Prefira deep link interno para decisao ja publicada em vez de repetir manifesto no post novo.
- Externos pra fontes (sempre cite, AEO valoriza).
- Texto descritivo, nunca "clique aqui" nem "aqui".

**Imagens:**
- Cover 1200x630 em `apps/landing/src/assets/blog/`.
- Para otimização com Astro `<Picture>`, covers ficam em `apps/landing/src/assets/blog/` e o frontmatter usa caminho relativo `../../assets/blog/...`. Não mova covers do blog para `public`.
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

Convenções canônicas de pt-BR vivem em [`writing.md`](writing.md). Para blog, além delas, mantenha:

- Frontmatter em ISO (`YYYY-MM-DD`).
- `description` com 40 a 60 palavras.
- H2 em sentence case.
- Slug curto e sem data no path.

## Checklist antes de commitar

- [ ] Título até 60 chars, sem emoji, sem travessão, verbo no presente
- [ ] Description 40 a 60 palavras, 1ª frase é o TL;DR
- [ ] Frontmatter completo (incluindo `keyTakeaways` e `faq` quando aplicável)
- [ ] H1 não está no markdown (vem do frontmatter)
- [ ] 3 a 6 H2, última é CTA ou "O que vem por aí"
- [ ] Cada afirmação técnica leva número, nome ou link
- [ ] Checklist final de [`writing.md`](writing.md) passou
- [ ] Cover image 1200x630 existe em `apps/landing/src/assets/blog/`
- [ ] Slug do arquivo bate com convenção
- [ ] Bullets com bold no termo
- [ ] CTA final em 1 linha
- [ ] `bun run landing:build` passa local
- [ ] **Plano de distribuição definido** (LinkedIn + X - ver seção abaixo)

### Teste do humano

O teste do humano vive em [`writing.md`](writing.md). Para blog, valide também que cada H2 tem pelo menos 1 detalhe específico real: tempo, número, nome, link ou cena.

---

## Anti-padrões de blog (rejeitar imediato)

Anti-padrões universais vivem em [`writing.md`](writing.md). Para blog, recuse também:

- H1 duplicado no markdown (o renderer já gera pelo frontmatter).
- Frontmatter incompleto.
- Description fora de 40 a 60 palavras.
- H2 numerado sem necessidade.
- Bullet de 1 item.
- 15 bullets seguidos sem sub-heading.
- Screenshot sem alt descritivo.
- Link com texto "aqui" ou "este link".
- Promessa de roadmap sem data.

## Pipeline de revisão

1. **Escreve o rascunho** seguindo o template.
2. **Roda checklist final de escrita** em [`writing.md`](writing.md).
3. **Roda stop-slop pass** em [`stop-slop.md`](stop-slop.md).
4. **Roda checklist de blog** deste arquivo.
5. **Lê em voz alta**. Se travou na leitura, reescreve a frase.
6. **Roda `bun run landing:build`** pra validar schema.
7. **Commita** com mensagem curta.
8. **Planeja a distribuição** (próxima seção).

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
description: "Deletamos 3.081 linhas. Removemos o módulo de Contatos porque ninguém usava."
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
