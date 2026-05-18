---
title: "Removemos o CRM do Montte. E foi uma decisão deliberada."
description: "Todo ERP brasileiro tem CRM nativo ou algo equivalente para relacionamento. O Montte decidiu remover o módulo de Contatos/CRM para focar em finanças e em uma operação mais simples, conversacional e orientada por IA."
publishedAt: 2026-05-18
author: "Manoel Neto"
tags: ["produto", "crm", "erp", "montte-ai", "operacao"]
category: "Produto"
coverImage: "../../assets/blog/montte-2026-05-15.jpg"
featured: false
readingMinutes: 4
keyTakeaways:
  - "Removemos o módulo de Contatos/CRM para reduzir atrito e focar no core financeiro do Montte."
  - "A mudança veio no commit `019ce11b`, com 3.081 linhas removidas em 37 arquivos."
  - "O recorte foi validado com benchmark de mercado e segue padrão de produto orientado a chat-first."
  - "Clientes atuais são tratados no alinhamento de continuidade via `MON-1106`."
  - "A decisão não elimina relacionamento, mas muda onde cada ferramenta faz sentido."
faq:
  - question: "O Montte não terá mais nenhum relacionamento com clientes?"
    answer: "O produto deixou de carregar um módulo nativo de CRM dentro do fluxo financeiro. O objetivo é ser claro: finanças no Montte e relacionamento no melhor stack do time comercial."
  - question: "Por que remover um módulo que parecia essencial?"
    answer: "Porque ele não era mais um diferencial técnico do Montte, e sim uma área que consumia capacidade de evolução no core onde o produto precisava concentrar energia."
  - question: "Essa decisão afeta quem já usa contatos hoje?"
    answer: "Sim, essa jornada precisa ser comunicada com cuidado. O impacto para usuários atuais está sendo acompanhado no alinhamento de execução (`MON-1106`)."
---

Todo ERP brasileiro tem CRM nativo — ou algum equivalente no pacote. O Montte também tinha.

E hoje o Montte foi contraintuitivo: decidiu remover o próprio módulo de Contatos/CRM.

Essa não é uma frase para marketing. É uma decisão de produto.

## O que tinha lá

Até agora, o módulo de Contatos/CRM no Montte tinha um fluxo completo: cadastro e edição de contatos, propriedades, colunas personalizadas, listagem, settings, onboarding próprio e vínculo com transações.

No Git, a mudança não foi cosmética:

- **hash:** `019ce11b`
- **mensagem:** `Remove contacts module`
- **3.081 linhas removidas**
- **37 arquivos removidos**

Retiramos o router de contatos, form sheet, properties panel, listagens e colunas, além da aba de contatos em transações.

Em outras palavras, removemos uma superfície de produto que já estava no legado e que parecia, até certo ponto, natural de manter.

## A pergunta que não respondemos antes

A pergunta é direta: **"Se todo ERP tem CRM, por que remover o nosso?"**

A resposta é menos sobre negar CRM e mais sobre reconhecer escopo.

No Montte, CRM deixava de ser uma vantagem prática e virava uma sobreposição de responsabilidades. O time de produto teve de dividir atenção entre:

- evolução financeira de baixa latência;
- correção de fluxo de dados transacionais;
- e manutenção de uma área de relacionamento que já não era o melhor lugar para o valor que pretendíamos entregar.

Não era sobre CRM funcionar mal. Era sobre o produto competir pelo foco errado.

## Verificação: mercado e evidência

Não tomamos decisão por opinião interna. Fizemos pesquisa direta.

### ERPs e CRM — verificação pública

| ERP | Tem CRM nativo? | Evidência |
|---|---|---|
| Bling | Sim | Módulo CRM/Relacionamento |
| Omie | Sim | CRM nativo com funil |
| Conta Azul | Sim | Gestão de clientes + integrações |
| Tiny | Sim | CRM com kanban e WhatsApp |
| NetSuite | Sim | CRM nativo |
| Odoo | Sim | App CRM nativo |

Também analisamos casos com abordagem diferente:

- **SAP B1:** sem CRM nativo, usa add-on/integração.
- **Zoho:** CRM como produto separado.

A leitura do benchmark ficou clara: em muitos ERPs o CRM é padrão esperado do pacote, não o ponto de diferenciação para este tipo de produto.

## Por que quebramos esse padrão (3 razões)

Não foi uma ruptura por estilo. Foi uma decisão de execução.

### 1) Foco no core que realmente importa

O Montte é, primeiro, uma solução financeira. Queremos ser ótimos em controle, previsibilidade e clareza operacional.

Enquanto o CRM cresce, o time de produto também cresce, mas não no mesmo ritmo. Esse desalinhamento não é visível no dia 1, mas aparece depois em prioridades atrasadas e features de menor retorno.

### 2) Custo de manutenção estava alto para o retorno

Cada ajuste no módulo de contatos impactava consistência de dados, fluxo de interface, onboarding e suporte.

Em contexto real, esse custo começou a atrapalhar a entrega de capacidades centrais. Isso não significa que o CRM seja ruim; significa que, para o Montte, ele já não carregava o peso de prioridade que deveria carregar.

### 3) O próximo passo do produto é conversa, não menu

Estamos migrando a operação para um produto mais simples de usar, com menos páginas e mais contexto.

A direção é **chat-first**: menos navegação por abas, mais continuidade por intenção. Isso casa melhor com uma rotina onde o usuário quer saber “o que fazer agora?” em vez de “onde eu clico para achar esse dado?”.

## O que veio no lugar

A remoção foi acompanhada por uma redistribuição de esforço para o que o Montte quer ser:

- contexto operacional orientado por IA;
- fluxo mais direto para decisões financeiras;
- integração via camadas dedicadas com ferramentas certas para relacionamento comercial.

A ideia não é negar gestão de relacionamento. É recusar que ela consuma o espaço estrutural do que deveria ser o núcleo financeiro do Montte.

## O que aprendemos

A decisão mostrou uma lição forte: **focar também dói no curto prazo, mas acelera no médio prazo**.

O que aprendemos com clareza:

1. **Decidir não fazer também é decisão de produto.**
2. **Benchmark público reduz viés interno.**
3. **Tom importa.** Remoção precisa ser comunicada com humildade, sem tom de superioridade e com respeito aos usuários atuais.

Na prática, clientes que usavam o módulo estão em acompanhamento específico, e o ponto de continuidade está registrado no `MON-1106` para não virar apenas “apagamos e ignoramos”.

## CTA

Não foi uma decisão para parecer ousado. Foi para ficar mais consistente.

Se você curte produto que assume trade-offs com transparência, esse é o tipo de decisão que nos permite ser melhores no que já é o nosso: entregar finanças mais claras, rápidas e úteis.

Se quiser acompanhar o que está por vir, o link canônico está aqui: **/blog/removemos-o-crm**.