---
title: "Todo ERP brasileiro tem CRM. Nós removemos o nosso."
description: "No recorte dos principais ERPs de PME no Brasil, CRM nativo virou padrão. O Montte removeu o módulo de Contatos/CRM para reduzir superfície, focar no core financeiro e seguir para uma experiência mais orientada por conversa com o Montte AI."
publishedAt: 2026-05-18
author: "Manoel Neto"
tags: ["produto", "crm", "erp", "montte-ai", "release"]
category: "Produto"
coverImage: "../../assets/blog/removemos-o-crm-cover.png"
featured: false
readingMinutes: 4
keyTakeaways:
  - "O Montte removeu o módulo de Contatos/CRM do produto principal."
  - "O commit `019ce11b` tirou 3.081 linhas em 37 arquivos."
  - "A decisão corta manutenção paralela e limpa o foco do core financeiro."
  - "O mercado brasileiro de ERP PME já trata CRM nativo como padrão."
  - "Clientes atuais entram em acompanhamento via `MON-1106`."
faq:
  - question: "O que saiu do Montte?"
    answer: "Saiu o módulo de Contatos/CRM do fluxo principal: router, form sheet, properties panel, listagem, colunas, settings, onboarding e a aba em transações."
  - question: "Isso significa que o Montte não atende mais relacionamento?"
    answer: "Não. Significa que o relacionamento deixou de morar dentro do produto principal. O Montte segue no financeiro e na operação; o CRM fica fora da superfície principal."
  - question: "Quem era usuário do módulo vai ficar sem resposta?"
    answer: "Não. Esse grupo entra no alinhamento de continuidade registrado em `MON-1106`, com comunicação e acompanhamento específicos."
---

Todo ERP brasileiro tem CRM. O Montte também tinha.

Agora não tem mais.

O commit `019ce11b` — **Remove contacts module** — tirou o módulo de Contatos/CRM do produto principal. Foram **3.081 linhas removidas** em **37 arquivos**. Não foi ajuste de UI. Foi remoção de superfície.

## O que saiu

Saiu o que deixava o módulo vivo no dia a dia:

- router de contatos;
- form sheet;
- properties panel;
- listagem;
- colunas;
- settings;
- onboarding;
- aba de contatos nas transações.

Na prática, o Montte deixou de carregar uma área inteira que já não era o melhor lugar para o valor que queríamos concentrar.

## A pergunta que não respondemos antes

A pergunta é simples: por que mexer nisso se quase todo ERP de PME no Brasil tem CRM nativo?

Porque, no nosso recorte, CRM deixou de ser diferencial e virou obrigação de pacote.

A gente conferiu o mercado: Bling, Omie, Conta Azul e Tiny tratam relacionamento como parte da experiência central. No resto do mercado, a lógica segue parecida: NetSuite e Odoo têm CRM nativo; SAP B1 depende de add-on; Zoho separa CRM como produto próprio.

Ou seja: a pergunta não era mais "dá para ter CRM?". Era "vale o custo de manter isso aqui dentro?".

## Por que quebrar o padrão

### 1) O core do Montte é financeiro

O Montte existe para dar clareza de operação financeira.

Quando o módulo de contatos ficou grande, ele passou a competir por prioridade com o que mais importa: fluxos, dados, consistência e velocidade de decisão no financeiro. Não fazia sentido continuar esticando a plataforma numa direção que não era a nossa melhor vantagem.

### 2) O custo de manutenção já não compensava

Cada ajuste no CRM carregava efeito colateral em outras partes do produto:

- mais regra;
- mais migração;
- mais suporte;
- mais tela para revisar;
- mais chance de desalinhamento entre fluxos.

O produto ficava maior, mas não ficava melhor na mesma proporção.

### 3) O próximo passo é chat-first

A direção do Montte agora é menos menu, mais contexto.

Em vez de abrir mais uma área para gerenciar relacionamento, a experiência vai ficar mais próxima de conversa: o usuário chega, pergunta, encontra, decide e segue. Isso reduz o ruído de navegação e aponta para o tipo de operação que queremos consolidar com o Montte AI.

## O que veio no lugar

Não foi um corte para deixar vazio.

O que veio no lugar foi foco:

- menos superfície dentro do ERP;
- mais clareza no financeiro;
- mais espaço para o fluxo conversacional;
- menos manutenção de uma área que já vivia melhor fora do produto principal.

Na prática, o Montte fica mais direto. Menos promessa de “fazer tudo”. Mais compromisso com a parte em que somos realmente bons.

## Quem é afetado

Quem usava o módulo de Contatos/CRM entra numa transição assistida.

Não tem drama escondido aqui: existe impacto, e ele está sendo acompanhado no `MON-1106`. O ponto é tratar isso como mudança de produto, não como limbo técnico.

## O que aprendemos

A parte menos glamourosa é a mais útil:

- **tirar também é construir**;
- **benchmark público evita fantasia de time**;
- **manter tudo dentro do produto não é sinônimo de servir melhor**.

A decisão ficou mais clara quando a comparamos com o mercado real e com o que o Montte precisa ser daqui para frente.

## Fechamento

Então é isso: todo ERP brasileiro tem CRM. O Montte tinha um também. E decidimos tirar.

Não para parecer ousado.

Para ficar mais focado.

Se você quer acompanhar a próxima fase do Montte, o caminho agora é menos abas, mais conversa, e um produto mais curto onde precisa ser curto.
