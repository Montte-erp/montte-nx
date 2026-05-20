# X (Twitter) - formatos, arquitetura de thread, algoritmo

Voz e regras pt-BR: ver [`blog.md`](blog.md). Esta ref cobre só o que é específico de X.

Curado de [ognjengt/founder-skills/x-writer](https://github.com/ognjengt/founder-skills) e [alirezarezvani X/Twitter Growth Engine](https://alirezarezvani.github.io/claude-skills/skills/marketing-skill/x-twitter-growth/). Mantive os 5 formatos que rendem pra voz Montte (founder build-log + opinião contrária + frameworks). Cortei "humor" e "reverse advice" - não casam com tom.

---

## Algoritmo X (resumo operacional)

**O que o X premia (peso decrescente):**
1. **Replies** - comentário > like > retweet. Posts que viram conversa têm reach exponencial.
2. **Time spent reading** - threads longas que prendem atenção sobem mais que tweet atômico viral. Bookmarks contam tanto quanto reply.
3. **Bookmarks** - sinal forte de "guardei pra ler depois".
4. **Quote tweets com adição** - QT que agrega contexto/dado novo > QT vazio "concordo".

**O que mata reach:**
- Link externo no corpo do tweet (corta ~50%). Solução: link na primeira **reply** do thread.
- Tweet com 4+ hashtags. Ideal: 0 hashtags.
- Postar mais de 5-6x/dia (canibaliza)
- Tweet apagado em < 30 min (sinaliza spam)

**Janela ideal:**
- B2B / tech / founders: Ter, Qua, Qui entre 9h-11h ou 15h-17h fuso do público
- Threads: começar antes das 10h pra ter pico de discussão durante o dia
- Atomic tweets: 21h-23h (scroll passivo noturno)

**Formatos rankeados por crescimento (do rezvani growth engine):**
1. **Thread** - maior conversão pra follower (5-12 tweets ideal)
2. **Atomic tweet** - impression farming, viralização rápida (<200 chars)
3. **Quote tweet com adição** - autoridade
4. **Reply em conta grande** - network growth, posicionar como standalone

---

## Formato 1 - Atomic tweet (One-Liner)

**O que é:** uma frase com impacto máximo em palavras mínimas.

**Estrutura:** `[afirmação única - opinião, observação ou verdade direta]`

**Linhas:** 1-2

**Por que funciona:** simplicidade compartilha. Pessoas retweetam o que conseguem ler em 2 segundos e concordar instantaneamente.

**Regras:**
- Cada palavra precisa merecer o lugar
- 1 ideia. Sem filler. Sem explicar.
- Se dá pra tirar uma palavra sem perder sentido, tira.

**Exemplo Montte:**
```
ERP brasileiro nasce com CRM dentro porque o concorrente tem. Não porque o cliente precisa.
```

---

## Formato 2 - Two-Part Punch

**O que é:** setup + line break + reframe/punchline.

**Estrutura:**
```
[Setup - afirma o esperado]

[Twist - contradiz ou ressignifica]
```

**Linhas:** 2-4 com quebra entre as partes

**Por que funciona:** o gap entre setup e punch cria tensão. O cérebro completa a expectativa, daí leva o reframe.

**Regras:**
- Setup precisa parecer completo sozinho
- A 2ª parte muda o sentido, não explica
- Nunca explica o twist - deixa cair

**Exemplo Montte:**
```
Removemos 3.081 linhas do código essa semana.

Foi a feature que mais cliente pediu desde então: nenhum.
```

---

## Formato 3 - Lista numerada

**O que é:** headline com número + itens + fechamento.

**Estrutura:**
```
[Hook headline: "N formas de..." / "As N coisas..."]

1. [Item]
2. [Item]
...
N. [Item]

[Fechamento opinativo ou acionável]
```

**Linhas:** 5-15

**Por que funciona:** números setam expectativa. Listas são scaneáveis. Bookmark-bait. Fechamento converte leitor passivo em engajado.

**Regras:**
- Números ímpares quando dá (7 > 6, 5 > 4)
- Cada item precisa ser específico e independente
- Fechamento opinativo, nunca "Espero que ajude!"

**Exemplo Montte:**
```
4 ERPs brasileiros. 4 com CRM nativo. 0 que o cliente realmente usa:

1. ERP A - CRM no menu principal
2. ERP B - funil de vendas completo
3. ERP C - gestão de clientes
4. ERP D - kanban + WhatsApp

Não é Bling, Omie ou Conta Azul. É camada de billing pra SaaS que não quer montar ERP por fora.
```

---

## Formato 4 - Progressão empilhada

**O que é:** padrão gramatical repetido que constrói momento, terminando em punchline que quebra o padrão.

**Estrutura:**
```
[Linha seguindo padrão]
[Mesmo padrão, escalando]
[Mesmo padrão, escalando mais]

[Punchline - quebra o padrão]
```

**Linhas:** 4-10

**Por que funciona:** ritmo cria antecipação. Cada linha puxa o leitor. O padrão hipnotiza, o payoff bate mais forte.

**Regras:**
- Toda linha **obrigatoriamente** segue a mesma estrutura gramatical
- Constrói do pequeno pro grande (ou inverso)
- Punchline **obrigatoriamente** quebra o padrão
- Variação: timeline ("2021: X / 2022: Y / 2023: Z")

**Exemplo Montte:**
```
2024: tínhamos módulo de Contatos.
2025: tínhamos módulo de Contatos com tags.
2026: tínhamos módulo de Contatos com tags e funil.

Hoje: deletamos os três.
```

---

## Formato 5 - Thread

**O que é:** múltiplos tweets ligados contando uma história/argumento. Formato de maior conversão pra follower.

**Arquitetura ideal (5-12 tweets):**

```
1/ [Hook tweet - promete payoff específico, 1 número se possível]
   ↓
2/ [Contexto - quem você é, por que tem direito de falar disso, 1-2 linhas]
   ↓
3/ [Tensão - o problema/contradição/descoberta, com stake concreto]
   ↓
4-N/ [Cada tweet = 1 ideia atômica. Sem "continuando…", sem repetir contexto.]
   ↓
N+1/ [Reframe - o que isso significa no agregado]
   ↓
N+2/ [CTA suave - "se isso ressoa, retweeta o tweet 1" ou "link blog na próxima"]
```

**Regras de thread:**
- 1º tweet **sozinho** precisa funcionar (vai ser tudo que muita gente vê)
- Cada tweet do meio = 1 ideia, **não** "tweet 3 de 9"
- Última line do tweet abre o próximo (cliffhanger curto)
- Sem emoji decorativo. Emoji só se carrega significado (1 por thread no max).
- Link externo: **na primeira reply** do thread, nunca no corpo
- Tamanho: 5-9 tweets é o sweet spot. <5 vira atomic. >12 perde retenção.

**Exemplo de hook tweet (thread Montte sobre remoção CRM):**
```
Todo ERP brasileiro tem CRM nativo.

Deletei o nosso semana passada. 3.081 linhas, 37 arquivos.

Aqui está o raciocínio - e os dados que confirmam que era módulo decorativo.
```

---

## Quando usar qual formato

| Tipo de post Montte | Formato preferido |
|----------------------|---|
| Repurpose de blog post completo | **Thread (5)** com link na 1ª reply |
| Opinião contrária curta | **Two-Part Punch (2)** ou **Atomic (1)** |
| Tabela de padrões de mercado sem ataque nominal | **Lista numerada (3)** |
| Evolução temporal ("Antes vs hoje") | **Progressão empilhada (4)** |
| Build-log com número de receita/custo | **Atomic (1)** ou abertura de **Thread (5)** |
| "Olha o que aprendi" (lições) | **Lista numerada (3)** com fechamento opinativo |

---

## Regras Montte adicionais (sobreescrevem genéricas)

- Threads do Montte sempre têm 1 número específico no tweet 1 (ex: 3.081 linhas, R$ 8.732,47, 4/4 ERPs)
- Nunca emoji decorativo em hook tweet
- Bling/Omie/Conta Azul só entram na negativa seca: "Não é Bling, Omie ou Conta Azul." Nunca ataque, ranking ou comparação de feature.
- Founder voice = 1ª pessoa ("eu"/"a gente"), não "Montte announces"
- Hashtag no X: zero, sempre
- Toda thread > 5 tweets termina com link pro blog post correspondente (na reply, não no corpo)

---

## Anti-padrões (recusar antes de mostrar pro user)

- "🧵 1/" como abertura. Soa template, corta reach. Hook precisa ser o conteúdo da 1ª linha.
- "Continuando…" / "↓" no meio dos tweets do thread
- Reply de auto-bump 5 horas depois ("Aliás, esqueci…")
- Tweet anunciando que vai postar thread ("amanhã solto thread sobre X")
- Quote tweet vazio ("isso 👆"). Agrega 0 contexto, queima reach
- Tweet com 2+ links no corpo
