# Hooks cross-channel - biblioteca reusável

Voz, posicionamento e regras pt-BR: ver [`writing.md`](writing.md). Esta ref cobre 10 hook patterns que servem pra abertura em qualquer canal (blog, LinkedIn, X).

Curado de [ognjengt/founder-skills/viral-hook-creator](https://github.com/ognjengt/founder-skills) (MIT). 19 patterns originais filtrados pros 10 que **batem com pillars Montte** e não conflitam com voz founder-led.

Cada hook tem: **template**, **psicologia**, **quando usar**, **exemplo adaptado pra Montte**, e **antipattern**.

---

## 1. Cautionary Tale (Histórica de Alerta)

**Psicologia:** pessoas aprendem com erro alheio. Vulnerabilidade = conexão.

**Template:** `"Eu [ação] e [resultado negativo]. O que aprendemos: [lição específica]."`

**Quando usar:** postmortem, "errei feio", build-log com falha real.

**Exemplo Montte:**
> Mantivemos o módulo de Contatos por 18 meses só porque todo ERP brasileiro tem um. A lição veio quando deletamos tudo.

**Antipattern:** falha fabricada / vaga ("aprendi muito com esse processo desafiador").

---

## 2. Analysis-Based (Insight Baseado em Análise)

**Psicologia:** pesquisa = credibilidade. Dado satisfaz a necessidade de prova.

**Template:** `"Analisei [N] [coisa]. Encontrei [N] [padrões/dados]."`

**Quando usar:** padrão de mercado sem ataque nominal, benchmark de categoria, post de dado.

**Exemplo Montte:**
> Olhei o menu dos 4 maiores ERPs brasileiros. Todos têm módulo CRM. Nenhum cliente Montte usava o nosso. O padrão ficou óbvio.

**Antipattern:** análise sem fonte/número, "muitos estudos mostram que…".

---

## 3. Contrarian (Contracorrente)

**Psicologia:** quebra de padrão. Padrão interrompe scroll.

**Template:** `"Todo mundo diz [X]. Os números apontam o contrário."`

**Quando usar:** opinião contrária com receipt, posicionamento contra status quo.

**Exemplo Montte:**
> ERP precisa ter CRM, dizem. Removemos o nosso e nenhum cliente reclamou. Nós copiávamos uma prateleira que ninguém abria.

**Antipattern:** contrarianismo sem evidência ("vou ser polêmico hoje:").

---

## 4. Data-Driven (Stat na Primeira Frase)

**Psicologia:** número específico desperta atenção. Específico bate genérico em 2-3x.

**Template:** `"[Número específico]. [O que esse número significa em 1 linha.]"`

**Quando usar:** build-log, anúncio de número de empresa, comparação quantitativa.

**Exemplo Montte:**
> 3.081 linhas deletadas. 37 arquivos removidos. 0 reclamação de cliente. Removemos o módulo de Contatos essa semana.

**Antipattern:** número arredondado/inventado ("crescemos muito"), claim sem follow-up.

---

## 5. The Unexpected (Quebra de Expectativa)

**Psicologia:** o cérebro completa a expectativa, leva o twist. Tensão = dwell time.

**Template:** `"[Esperado]. [Inesperado.]"`

**Quando usar:** tweet 2-part punch, abertura de blog post, headline.

**Exemplo Montte:**
> A feature mais pedida pelos clientes Montte essa semana? Nenhuma. Removemos 3.081 linhas e ninguém percebeu.

**Antipattern:** twist forçado / engraçadinho, "spoiler: você não vai acreditar…".

---

## 6. Achievement with Constraint (Conquista com Limitação)

**Psicologia:** restrição amplifica a conquista. "Como conseguiram com isso?"

**Template:** `"Como fizemos [resultado] em [tempo] sem [limitação esperada]."`

**Quando usar:** build-log de feature shipada com restrição real, hiring/ops.

**Exemplo Montte:**
> Como deletamos 1/8 do módulo principal do Montte em uma tarde, sem migração de banco e sem suporte virar incêndio.

**Antipattern:** conquista vaga ("crescemos rápido com poucos recursos").

---

## 7. Steal My Process (Rouba Meu Processo)

**Psicologia:** sistema pronto > conselho genérico. "Rouba" sugere exclusividade.

**Template:** `"O [processo/checklist] que usamos pra [resultado]. Rouba."`

**Quando usar:** post de framework/playbook, repurpose de doc interno.

**Exemplo Montte:**
> O checklist de 7 perguntas que usamos antes de remover qualquer módulo do Montte. Rouba e roda no seu produto.

**Antipattern:** "rouba" sem o processo real anexado, lead-magnet por trás do email.

---

## 8. Behind-the-Scenes (Bastidor Não-Curado)

**Psicologia:** insider status. Detalhe específico mata detector de AI slop.

**Template:** `"Ontem [coisa específica aconteceu]. [Detalhe sensorial.]"`

**Quando usar:** build-log de descoberta inesperada, momento de produto real.

**Exemplo Montte:**
> Ontem, abri o dashboard do PostHog pra ver quantos cliques o módulo de Contatos tinha tido no mês. 14. De 6 organizações diferentes. Foi quando decidi deletar.

**Antipattern:** bastidor inventado / sem âncora sensorial.

---

## 9. Tiny Change, Big Impact (Mudança Pequena, Impacto Grande)

**Psicologia:** assimetria custo/benefício atrai. Promete payoff fácil.

**Template:** `"Mudamos [coisa pequena] e [resultado desproporcional]."`

**Quando usar:** otimização, refactor que destravou métrica, decisão de produto small/big.

**Exemplo Montte:**
> Trocamos `space-y-*` por `gap-*` em toda a interface. Quebrou 0 layout. Resolveu 3 bugs antigos de spacing inconsistente.

**Antipattern:** mudança vaga ("mudamos nosso mindset"), claim sem stat.

---

## 10. Reset Expectations (Reseta a Expectativa)

**Psicologia:** "esquece o que te disseram, a verdade é outra". Pattern interrupt.

**Template:** `"Esquece [conselho consagrado]. Em [contexto], [tese contrária concreta]."`

**Quando usar:** opinião que contradiz consenso de mercado, reframe de positioning.

**Exemplo Montte:**
> Esquece "ERP precisa ter tudo". O ERP do futuro tem **menos módulos** que o concorrente, não mais. No nosso caso, CRM virou peso morto.

**Antipattern:** "esquece" sem tese concreta, reframe sem fundamentação.

---

## Como combinar com fórmulas do canal

Estes hooks são **camada 0** - abertura. Depois engata na fórmula completa do canal:

| Hook (camada 0) | Funde bem com (canal) |
|------------------|------------------------|
| Cautionary Tale (1) | F4 Confissão (LinkedIn), Thread (X) |
| Analysis-Based (2) | F10 Contrarian+Receipts (LinkedIn), Lista numerada (X) |
| Contrarian (3) | F2 R.I.P. (LinkedIn), Two-Part Punch (X) |
| Data-Driven (4) | F7 Ledger (LinkedIn), Atomic (X) |
| The Unexpected (5) | F2 R.I.P. (LinkedIn), Two-Part Punch (X) |
| Achievement w/ Constraint (6) | F3 Year-over-Year (LinkedIn), Thread (X) |
| Steal My Process (7) | F1 Anaphora (LinkedIn), Lista numerada (X) |
| Behind-the-Scenes (8) | F9 Curiosity-Gap (LinkedIn), Atomic (X) |
| Tiny Change, Big Impact (9) | F7 Ledger (LinkedIn), Two-Part Punch (X) |
| Reset Expectations (10) | F2 R.I.P. (LinkedIn), Progressão Empilhada (X) |

---

## Trigger words que ampliam hook (uso ≤ 2 por post)

**Insider:** secretamente, revelado, escondido, descoberto, gatekeeped, dos bastidores
**Helper/urgência:** perdendo, queimando, vazando, custando, sangrando, drenando
**Thinker/contrário:** ao contrário, mito, paradoxo, contraintuitivo, errado, fim de
**Amplifier:** literalmente, zero, todo, completamente, exato, real

**Regra Montte:** trigger word só se for verdade literal. "Secretamente" só se realmente foi escondido. "Literalmente" só se for literal. Trigger inflacionado vira AI tell.

---

## Anti-padrões universais (recusar antes de mostrar)

- Hook que promete payoff sem entregar no corpo
- "Você não vai acreditar…" / "Vou te mostrar…"
- Trigger word repetida (2x "secretamente" no mesmo post)
- Hook genérico aplicável a qualquer empresa ("dicas pra crescer seu negócio")
- Número inflado/inventado pra parecer específico
- Pergunta retórica como hook ("Você já se perguntou…?")
