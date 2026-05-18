---
name: montte-social
description: Write marketing content for Montte across blog, LinkedIn, and X (Twitter). Founder-led, pt-BR, Zed/PostHog voice, anti-AI-tells, hook formulas com track-record verificado em 2025-2026. Use ao escrever blog post, LinkedIn post, tweet, thread X, ou repurpose entre canais. Canais ativos hoje: blog (canônico) + LinkedIn + X. Instagram fora de escopo.
---

# Montte Social, Marketing Skill

Skill única de marketing Montte. Cobre **blog, LinkedIn e X**. Voz canônica, regras de humanização, anti-AI-tells e convenções pt-BR vivem em [`references/blog.md`](references/blog.md) — qualquer canal herda. Hook formulas e algoritmo de cada plataforma ficam nos refs específicos.

Curadoria de hook formulas adaptada de [sergebulaev/linkedin-skills](https://github.com/sergebulaev/linkedin-skills), [ognjengt/founder-skills](https://github.com/ognjengt/founder-skills) e [alirezarezvani X/Twitter Growth Engine](https://alirezarezvani.github.io/claude-skills/skills/marketing-skill/x-twitter-growth/) (todas MIT).

---

## Quando usar

- Escrever blog post Montte (canônico)
- Escrever post LinkedIn (curto/médio/longo) ou comentário
- Escrever tweet único ou thread X
- Repurpose de blog post Montte → LinkedIn + X
- Reverse-engineer de post viral pra extrair fórmula
- Audit de draft antes de publicar (anti-slop pass)

Não usar pra: legenda Instagram, e-mail marketing, copy de landing — fora de escopo.

## Roteamento

| Tarefa | Abrir antes |
|--------|-------------|
| Blog post novo (canônico) | `references/blog.md` (skill completa de escrita + distribuição) |
| Post LinkedIn | `references/blog.md` §Voz + §Humanização → `references/linkedin.md` |
| Tweet ou thread X | `references/blog.md` §Voz + §Humanização → `references/x.md` |
| Repurpose blog → LinkedIn + X | `references/blog.md` §Cadeia de distribuição → `references/linkedin.md` + `references/x.md` |
| Hook novo (qualquer canal) | `references/hooks-cross-channel.md` |
| Audit/humanizer de draft pronto | `references/blog.md` §Humanização + checklist abaixo |

## Quick workflow

1. **Decide canal e tipo de post.** Blog = canônico, todo conteúdo de fôlego começa aqui. LinkedIn + X são derivados.
2. **Abre `references/blog.md`** pra voz + regras pt-BR + anti-AI-tells. Vale pra qualquer canal.
3. **Abre ref do canal alvo** pra hook formula + algoritmo + char rules.
4. **Rascunha.** Nome próprio + número específico + 1ª pessoa concreta a cada ~100 palavras.
5. **Anti-slop pass.** Aplica checklist abaixo. Se sobrou tell, reescreve a frase.
6. **Algorítmo pass.** Aplica regras do canal no ref correspondente.
7. **Aprovação.** Mostra: fórmula usada, draft completo, char count, janela de publicação sugerida, riscos.

## Anti-slop checklist (universal, qualquer canal)

Cortar antes de publicar:

- [ ] Travessões (`—`). Substituir por ponto, vírgula ou reescrever.
- [ ] "No mundo acelerado…", "Estou animado pra…", "Hoje viemos compartilhar…", "Em um cenário…"
- [ ] "Game-changer", "deep dive", "alavancar", "fundamentalmente", "robusto", "leverage", "boilerplate", "no fim do dia"
- [ ] Regra dos três sem números/exemplos concretos
- [ ] All-caps na primeira linha (`ISSO MUDOU TUDO.`)
- [ ] Listas com 3 bullets onde cada bullet é abstrato ("clareza, foco, execução")
- [ ] "Tag alguém que precisa ver isso" / "Concorda? Comenta aí" como close — engagement-bait genérico
- [ ] Emoji decorativo em headline
- [ ] Mais de 1 hashtag por post LinkedIn, mais de 0 no corpo do X
- [ ] Link externo no corpo do post LinkedIn (vai pro 1º comentário)
- [ ] Frase "como um humano cansado escreveria"? Se não, reescreve.

## Pillars Montte

Conteúdo cai num dos quatro. Se não cai, provavelmente não é pra publicar.

1. **Removemos X / quebramos padrão Y** — opinião contrária baseada em decisão real do produto (ex: removemos CRM, removemos Instagram, removemos planilha de billing)
2. **Build log** — número específico + nome próprio + lição (ex: "deletamos 3.081 linhas hoje", "consertamos N bug em M horas")
3. **Postmortem / "errei feio"** — vulnerabilidade real com data e impacto, fechamento com aprendizado
4. **Position contra ERP tradicional** — Montte é plataforma operacional com IA nativa, não "ERP simples"; concorrente é status quo (Bling, Omie, ContaAzul como referência de mercado, não como ataque)

## Resources

- `references/blog.md` — voz canônica Montte (vale pra todo canal) + humanização + templates de blog + frontmatter SEO/AEO/GEO + cadeia de distribuição blog→LinkedIn→X
- `references/linkedin.md` — hook formulas, algoritmo 2026, char rules, anti-padrões LinkedIn
- `references/x.md` — formatos de tweet, arquitetura de thread, algoritmo X, regras anti-padrão
- `references/hooks-cross-channel.md` — biblioteca de hook patterns reusáveis (blog/LinkedIn/X)

## Skills relacionadas

- [`linear-cli`](../linear-cli/SKILL.md) — criar/atualizar issues no projeto MAR (Montte Marketing) com a proposta antes de publicar.

## Crédito

- Voz e regras pt-BR: estilo base blog do Zed + PostHog transparency
- Hook formulas LinkedIn: adaptadas de [sergebulaev/linkedin-skills](https://github.com/sergebulaev/linkedin-skills) (MIT)
- Hook formulas cross-channel: adaptadas de [ognjengt/founder-skills](https://github.com/ognjengt/founder-skills) (MIT)
- X formats e algoritmo: adaptados de [ognjengt/founder-skills/x-writer](https://github.com/ognjengt/founder-skills) e [X/Twitter Growth Engine](https://alirezarezvani.github.io/claude-skills/skills/marketing-skill/x-twitter-growth/) (MIT)
