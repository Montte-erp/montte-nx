---
name: marketing
description: "Write marketing content for Montte across blog, LinkedIn, and X (Twitter). Founder-led, pt-BR, Zed/PostHog voice, anti-AI-tells, hook formulas com track-record verificado em 2025-2026. Use ao escrever blog post, LinkedIn post, tweet, thread X, ou repurpose entre canais. Canais ativos hoje: blog (canônico) + LinkedIn + X. Instagram fora de escopo."
---

# Marketing

Skill única de marketing Montte. Cobre **blog, LinkedIn e X**. Voz canônica, posicionamento, regras de humanização, anti-AI-tells e convenções pt-BR vivem em [`references/writing.md`](references/writing.md) - qualquer canal herda. Hook formulas, templates e algoritmo de cada plataforma ficam nos refs específicos. O pass final anti-slop vive em [`references/stop-slop.md`](references/stop-slop.md).

Curadoria de hook formulas adaptada de [sergebulaev/linkedin-skills](https://github.com/sergebulaev/linkedin-skills), [ognjengt/founder-skills](https://github.com/ognjengt/founder-skills) e [alirezarezvani X/Twitter Growth Engine](https://alirezarezvani.github.io/claude-skills/skills/marketing-skill/x-twitter-growth/) (todas MIT). Anti-slop adaptado de [hardikpandya/stop-slop](https://github.com/hardikpandya/stop-slop) (MIT).

---

## Quando usar

- Escrever blog post Montte (canônico)
- Escrever post de blog a partir de GitHub Release publicada
- Escrever post LinkedIn (curto/médio/longo) ou comentário
- Escrever tweet único ou thread X
- Repurpose de blog post Montte → LinkedIn + X
- Reverse-engineer de post viral pra extrair fórmula
- Audit de draft antes de publicar (anti-slop pass)

Não usar pra: legenda Instagram, e-mail marketing, copy de landing - fora de escopo.

## Roteamento

| Tarefa | Abrir antes |
|--------|-------------|
| Blog post novo (canônico) | `references/writing.md` + `references/blog.md` |
| Blog post de release publicada | `references/writing.md` + [`references/blog.md`](references/blog.md) + [`references/release-post.md`](references/release-post.md) |
| Post LinkedIn | `references/writing.md` → `references/linkedin.md` |
| Tweet ou thread X | `references/writing.md` → `references/x.md` |
| Repurpose blog → LinkedIn + X | `references/writing.md` + `references/blog.md` §Cadeia de distribuição → `references/linkedin.md` + `references/x.md` |
| Hook novo (qualquer canal) | `references/writing.md` + `references/hooks-cross-channel.md` |
| Audit/humanizer de draft pronto | `references/writing.md` + `references/stop-slop.md` + checklist abaixo |

## Quick workflow

1. **Decide canal e tipo de post.** Blog = canônico, todo conteúdo de fôlego começa aqui. LinkedIn + X são derivados.
2. **Abre `references/writing.md`** pra voz + regras pt-BR + anti-AI-tells. Vale pra qualquer canal.
3. **Abre ref do canal alvo** pra hook formula + algoritmo + char rules.
4. **Rascunha.** Nome próprio + número específico + 1ª pessoa concreta a cada ~100 palavras.
5. **Anti-slop pass.** Aplica checklist abaixo e `references/stop-slop.md`: frase muleta, contraste mecânico, voz passiva, agência falsa e ritmo metronômico. Se sobrou tell, reescreve a frase.
6. **Algorítmo pass.** Aplica regras do canal no ref correspondente.
7. **Aprovação.** Mostra: fórmula usada, draft completo, char count, janela de publicação sugerida, riscos.

## Anti-slop checklist (universal, qualquer canal)

Cortar antes de publicar:

- [ ] Em dash (U+2014) ou en dash (U+2013). Substituir por ponto, vírgula ou reescrever.
- [ ] "No mundo acelerado…", "Estou animado pra…", "Hoje viemos compartilhar…", "Em um cenário…"
- [ ] "Game-changer", "deep dive", "alavancar", "fundamentalmente", "robusto", "leverage", "boilerplate", "no fim do dia"
- [ ] Regra dos três sem números/exemplos concretos
- [ ] All-caps na primeira linha (`ISSO MUDOU TUDO.`)
- [ ] Listas com 3 bullets onde cada bullet é abstrato ("clareza, foco, execução")
- [ ] "Tag alguém que precisa ver isso" / "Concorda? Comenta aí" como close - engagement-bait genérico
- [ ] Emoji decorativo em headline
- [ ] Hashtag em LinkedIn só se for 1 nichada e no fim; no X, 0 hashtags
- [ ] Link externo no corpo do post LinkedIn (vai pro 1º comentário)
- [ ] Frase "como um humano cansado escreveria"? Se não, reescreve.
- [ ] Abertura muleta: "aqui está", "a verdade é", "o ponto é", "isso importa porque". Cortar.
- [ ] Contraste mecânico "não X, mas Y" fora do posicionamento canônico. Afirmar Y direto.
- [ ] Passiva ou sujeito escondido: "foi feito", "foi criado", "foi adicionado". Nomear quem fez.
- [ ] Inanimado agindo como humano: "os dados mostram", "a decisão surgiu", "a cultura muda". Reescrever com ator humano.
- [ ] Advérbio ou amaciador sem fato: "realmente", "simplesmente", "basicamente", "muito", "extremamente".
- [ ] Fechamento com frase de palestra: "ponto final", "isso muda tudo", "no fim, tudo se resume a".

## Pillars Montte

Conteúdo cai num dos quatro. Se não cai, provavelmente não é pra publicar.

1. **Removemos X / quebramos padrão Y** - opinião contrária baseada em decisão real do produto (ex: removemos CRM, removemos planilha de billing)
2. **Build log** - número específico + nome próprio + lição (ex: "deletamos 3.081 linhas hoje", "consertamos N bug em M horas")
3. **Postmortem / "errei feio"** - vulnerabilidade real com data e impacto, fechamento com aprendizado
4. **Position: camada de billing, não ERP** - Montte é a camada que falta no SaaS brasileiro pra facilitar a vida do founder; cobra, mede, fatura e mostra saúde financeira sem ERP separado. Bling/Omie/Conta Azul aparecem só na negativa seca: "Não é Bling, Omie ou Conta Azul."

## Posicionamento (canônico)

Antes de escrever qualquer post, fixar o frame:

- **Tagline public:** "a camada que falta no SaaS brasileiro pra facilitar a vida do founder".
- **Pitch curto:** "billing pra SaaS de um jeito que o founder não precise de ERP".
- **Mental model interno (NÃO usar em copy):** Montte = mistura de **Autumn** (dev-facing billing layer, Customer como primitiva, `customers.state`) + **Rillet** (founder/ops AI accounting, auto-categorização, conciliação, dashboards).
- **Nome do produto em copy:** apenas "Montte". Nunca "Montte Payments", "Montte ERP", "Montte CRM".
- **CRM:** Twenty é a primeira integração porque o Montte usa internamente. Nenhum outro CRM citável.
- **Pagamento:** Abacate Pay como primeiro adapter. Asaas, Stripe, Mercado Pago como gateway de referência.
- **Não-concorrência:** "Não é Bling, Omie ou Conta Azul." Afirmação seca, sem "estamos tentando ser".

Detalhes completos (frases canônicas, banidas, hierarquia de menção, vocabulário) em [`references/writing.md` §Posicionamento canônico](references/writing.md). Sempre abrir antes de rascunhar.

## Resources

- `references/writing.md` - voz canônica Montte, posicionamento, pt-BR, humanização e checklist final para qualquer canal
- `references/blog.md` - formato de blog, templates, frontmatter SEO/AEO/GEO + cadeia de distribuição blog→LinkedIn→X
- `references/release-post.md` - regras para transformar release notes publicadas em post de blog canônico
- `references/linkedin.md` - hook formulas, algoritmo 2026, char rules, anti-padrões LinkedIn
- `references/x.md` - formatos de tweet, arquitetura de thread, algoritmo X, regras anti-padrão
- `references/hooks-cross-channel.md` - biblioteca de hook patterns reusáveis (blog/LinkedIn/X)
- `references/stop-slop.md` - pass final para remover AI-tells estruturais, passiva, contraste mecânico, agência falsa e frases de palestra

## Skills relacionadas

- [`linear-cli`](../linear-cli/SKILL.md) - criar/atualizar issues no projeto MAR (Montte Marketing) com a proposta antes de publicar.

## Crédito

- Voz e regras pt-BR: estilo base blog do Zed + PostHog transparency
- Hook formulas LinkedIn: adaptadas de [sergebulaev/linkedin-skills](https://github.com/sergebulaev/linkedin-skills) (MIT)
- Hook formulas cross-channel: adaptadas de [ognjengt/founder-skills](https://github.com/ognjengt/founder-skills) (MIT)
- X formats e algoritmo: adaptados de [ognjengt/founder-skills/x-writer](https://github.com/ognjengt/founder-skills) e [X/Twitter Growth Engine](https://alirezarezvani.github.io/claude-skills/skills/marketing-skill/x-twitter-growth/) (MIT)
- Stop-slop pass: adaptado de [hardikpandya/stop-slop](https://github.com/hardikpandya/stop-slop) (MIT)
