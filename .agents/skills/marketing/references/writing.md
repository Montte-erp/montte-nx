# Writing - voz, copy e revisão Montte

Fonte canônica de escrita Montte para blog, LinkedIn e X. Este arquivo cobre voz, posicionamento, pt-BR, humanização e checklist final. Regras de formato ficam nos refs de canal: [`blog.md`](blog.md), [`linkedin.md`](linkedin.md) e [`x.md`](x.md).

Regra de ouro: **o texto precisa soar como se um humano cansado tivesse escrito num café, não como se um LLM tivesse gerado num pipeline**.

---

## Voz Montte

| Faça | Não faça |
|------|----------|
| "Você abre o Montte e..." | "Os usuários têm acesso a..." |
| "Nós erramos o deploy." | "Houve um incidente." |
| "30% mais rápido, medimos em 2,3s indo pra 1,6s." | "Significativamente mais rápido." |
| "No Montte, a tabela..." | "Na nossa plataforma de ERP..." |
| "Não funcionou. Refizemos." | "Após exaustiva análise, optamos por refatorar." |
| Citar pessoa real, cliente real ou ferramenta real | "Um membro da comunidade" |
| "A gente perdeu duas tardes nisso." | "Investimos esforço significativo nesta tarefa." |

**Pronomes:** "nós/a gente" como padrão de equipe Montte. "eu" só em post de opinião assinado por uma pessoa. "você" direto pro leitor.

**Tom:** founder-led, seco, concreto. Humor raro. Emoji raro. Nada de palestra motivacional.

**Marca:** Montte é masculino. Escreva "no Montte" e "do Montte". Nome do produto é só "Montte" em copy public-facing.

---

## Posicionamento canônico

A frase-régua:

> camada de billing pra SaaS de um jeito que o founder não precise de ERP

Tagline public oficial:

> a camada que falta no SaaS brasileiro pra facilitar a vida do founder

Use literalmente quando precisar de tagline. Não reinvente.

### O que dizer

| Tema | Forma canônica |
|------|----------------|
| O que é o Montte | "Camada de billing que falta no SaaS brasileiro." |
| Posicionamento amplo | "A camada que falta no SaaS brasileiro pra facilitar a vida do founder." |
| Promessa pro founder | "Cobrança, uso, fatura e estado do cliente sem precisar montar um ERP por fora." |
| Customer | "Primitiva de cobrança por uso." |
| API central | "`customers.state` devolve assinatura, uso, fatura e status numa chamada." |
| CRM | "Twenty é a primeira integração porque o Montte usa o Twenty internamente." |
| Pagamento | "Abacate Pay vai entrar como primeiro adapter." |
| Não-concorrência | "Não é Bling, Omie ou Conta Azul." |

### O que não dizer

| Não use | Use |
|---------|-----|
| "Montte Payments", "Montte CRM", "Montte ERP" | "Montte" |
| "Runtime de billing" | "camada de billing" |
| "ERP simples", "ERP nacional", "ERP brasileiro" | "sem ERP" |
| "Plataforma operacional completa" | tagline oficial |
| "Infraestrutura de pagamentos" | "camada de billing" |
| "Stack de billing", "stack de finanças" | "camada" ou nome concreto do fluxo |
| "Solução all-in-one" | diga o que o produto faz |
| "Founder-friendly", "developer-first" | mostre pelo caso concreto |
| "Não estamos tentando ser X" | "Não é Bling, Omie ou Conta Azul." |
| "Facilitamos a vida de empresas brasileiras" | tagline oficial |

### Hierarquia de menção

- ✅ Twenty: única integração de CRM citável. É a primeira porque o Montte usa internamente.
- ✅ Abacate Pay: primeiro adapter de pagamento. Pode citar em escopo de billing.
- ⚠️ DocuSeal: citável só quando o tema for documentos.
- ❌ Bling, Omie, Conta Azul: só como referência negativa seca. Nunca ataque ou comparação de feature.
- ❌ Pipedrive, HubSpot, Salesforce: não citar como integração.
- ❌ Autumn, Rillet, Polar, Stripe Billing, Lago, Orb: podem aparecer só em survey/contexto técnico, nunca como comparação direta em headline.
- ❌ Mastra, Vercel AI SDK, `@packages/agents`: não existem no Montte. Não mencionar.

### Vocabulário operacional

- "Customer" em código e texto técnico. "Cliente" em copy founder-facing.
- "Cobrança por uso" em vez de "usage-based billing".
- "Adapter de pagamento" ok. "Adaptador de pagamento" também.
- "Plano", "assinatura", "fatura", "uso medido", "status de pagamento".
- "Centro de Custo" sempre que aparecer o que outros chamam de tag.
- "Build in public" pode aparecer. "Transparência radical" não.
- Quando NFe vier: "emissão própria, sem SaaS".

---

## Convenções pt-BR

- "Montte" é masculino: "no Montte", "do Montte".
- "Lançamento" é transação financeira. Pra release de produto, use "release", "atualização" ou "versão".
- Decimais com vírgula: "2,3s", "R$ 1.500,00".
- Datas em corpo: "15 de maio de 2026". ISO só em frontmatter.
- "Você", não "tu".
- "A gente" é ok em opinião/founder posts. "Nós" em release e feature.
- "Pra" e "pro" são ok em prosa. Use "para" quando a copy pedir mais formalidade.
- "Tá" só em opinião casual, nunca em release.
- Sem vírgula antes do "e" final, exceto para resolver ambiguidade.

### Anglicismos

Traduza quando existe alternativa natural:

| Não use | Use |
|---------|-----|
| deployar | publicar, subir pra produção, fazer release |
| feature | funcionalidade, recurso |
| performance | desempenho |
| task | tarefa |
| workflow | fluxo, fluxo de trabalho |
| dashboard | painel |
| stakeholder | time, área, parte interessada |
| key takeaway | ponto principal |
| case | caso, exemplo |
| insight | descoberta, observação, achado |
| pipeline | fluxo, esteira |
| shipar | entregar, lançar, subir |
| trade-off | troca, concessão |
| edge case | caso extremo |
| boilerplate | código repetitivo, esqueleto |

Termos técnicos sem boa tradução podem ficar: oRPC, TanStack, Drizzle, framework, checkout, feedback, release.

---

## Humanização

LLMs deixam pegadas: travessão em excesso, ritmo uniforme, vocabulário previsível, listas de três itens em loop e fechamento formal. Corte isso antes de publicar.

### 1. Travessão longo está banido

Zero em dash (U+2014) e zero en dash (U+2013). Substitua por vírgula, ponto, parênteses ou dois pontos.

Hífen `-` está ok em lista markdown e palavra composta.

### 2. Varie comprimento de frase

Misture curta, média e longa.

- Curta: "Não funcionou. Refizemos."
- Média: "A tabela ganhou agrupamento por data e categoria."
- Longa: "Antes dessa release, ver o fluxo de caixa do dia exigia filtro manual, export pra planilha e dois minutos perdidos por tarefa."

Evite três frases médias seguidas.

### 3. Repita a palavra certa

Não force sinônimo para parecer sofisticado. Se a palavra é "tabela", repita "tabela". Melhor repetição clara do que "painel", "interface" e "experiência" sem motivo.

### 4. Quebre lista de três

LLM adora "clareza, foco e execução". Use 2 itens, 4 itens, lista numerada ou prosa. Se uma seção já tem 3 bullets, a próxima não precisa ter.

### 5. Coloque cicatriz real

Em post de release, feature ou opinião, procure uma frase de imperfeição:

- "Tentamos com X, deu ruim, voltamos pra Y."
- "Achei que era simples. Não era."
- "Perdemos duas tardes nisso."

### 6. Troque adjetivo por detalhe

| Vago | Concreto |
|------|----------|
| "muito rápido" | "de 2s pra 500ms" |
| "vários clientes" | "12 clientes do lote beta" |
| "recentemente" | "na sexta passada" |
| "equipe pequena" | "três pessoas: eu, Lucas e Bia" |
| "grande melhoria" | "30% menos cliques" |

### 7. Não despedir

Corte "em conclusão", "por fim", "resumindo", "até a próxima", "espero que tenha gostado". Última frase é ação concreta ou afirmação seca.

---

## Anti-padrões universais

Rejeite antes de mostrar:

- "No mundo acelerado de hoje..."
- "Em um cenário cada vez mais competitivo..."
- "Estamos animados em anunciar..."
- "Hoje viemos compartilhar..."
- "Neste post, vamos explorar..."
- "É importante notar que..."
- "Vale ressaltar que..."
- "Cabe destacar..."
- "Em suma", "em síntese", "por fim"
- "Não apenas X, mas também Y"
- "Vamos mergulhar fundo..."
- "Desvendar", "desbravar", "jornada" como metáfora vaga
- "Empoderar", "sinergia", "robusto", "poderoso", "elegante"
- "Game-changer", "next-level", "best-in-class"
- Emoji decorativo em headline
- All-caps na primeira linha
- Engagement bait: "Tag alguém que precisa ver isso", "Concorda? Comenta aí"

---

## Checklist final de escrita

- [ ] O texto usa a tagline ou o pitch canônico quando fala de posicionamento?
- [ ] O produto aparece como "Montte", sem sufixo?
- [ ] "no Montte" e "do Montte", nunca "na Montte"?
- [ ] Cada afirmação técnica tem número, nome, data, link ou cena?
- [ ] Nenhum em dash ou en dash?
- [ ] Zero anglicismo evitável?
- [ ] Ritmo varia?
- [ ] Tem ao menos uma cicatriz real quando o formato permite?
- [ ] Nenhuma frase da lista de anti-padrões?
- [ ] O fechamento não parece despedida formal?

## Quando abrir `stop-slop.md`

Depois deste checklist, rode [`stop-slop.md`](stop-slop.md) quando o texto ainda soar polido demais, genérico demais ou com cara de IA.

O pass de stop-slop procura abertura muleta, contraste mecânico, passiva, agência falsa, abstração sem cena, advérbio vazio, ritmo metronômico e frase de palestra.
