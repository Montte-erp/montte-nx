---
title: "Removemos o CRM. Empurramos pro Twenty."
description: "O Montte tirou o módulo de Contatos: 3.081 linhas em 37 arquivos. Relacionamento passa a viver no Twenty, com a integração planejada como fronteira oficial. O Customer está virando primitive de cobrança, no espírito do Autumn e do Polar. O destino é runtime de billing brasileiro."
publishedAt: 2026-05-18
author: "Manoel Neto"
tags: ["opiniao", "crm", "billing", "twenty"]
category: "Opinião"
coverImage: "../../assets/blog/removemos-o-crm-cover.png"
featured: false
readingMinutes: 3
keyTakeaways:
   - "O módulo de Contatos saiu do produto: 3.081 linhas em 37 arquivos."
   - "Relacionamento passa a viver no Twenty. Integração no roadmap como fronteira oficial."
   - "O Customer no Montte está virando primitive de cobrança, inspirado em Autumn e Polar."
   - "O Montte é runtime de billing usage-based brasileiro, não ERP."
faq:
   - question: "Por que o Montte não tem mais módulo de Contatos?"
     answer: "Porque o lugar do relacionamento é em ferramenta dedicada. No Montte, o Customer existe pra cobrança, não pra pipeline."
   - question: "A integração com o Twenty já está pronta?"
     answer: "Ainda não. Está planejada como fronteira oficial do Montte, ao lado do PostHog. O escopo inicial é mapear o Customer do Montte para Company ou Person no Twenty."
   - question: "Então o Montte virou o quê?"
     answer: "Runtime de billing usage-based brasileiro, no espírito do Autumn e do Polar. O Customer vai agregar assinaturas, uso, faturas e status de pagamento numa resposta só. Tem peça por construir, e a gente conta em público."
---

Tinha um módulo de Contatos no Montte. Não tem mais. Saíram 3.081 linhas em 37 arquivos. Relacionamento passa a viver fora, com a integração com o Twenty no roadmap.

## O que saiu

Router de contatos, formulário, painel de propriedades, listagem, colunas, settings, passo no onboarding e a aba de contatos dentro de transações. A coluna `contactId` em transações é o resíduo de schema, sai junto na sequência.

O módulo funcionava. O problema era de posição.

## Por que saiu

Cada ajuste em outra área puxava regra nova no Contatos, migração, mais tela pra revisar. O módulo ia crescer pra parecer Pipedrive, e a gente não quer ser Pipedrive.

A escolha aqui é antiga. Ou se vira metade CRM, ou se assume que CRM mora em ferramenta dedicada. Optamos pela segunda.

## Onde o relacionamento vai morar

[Twenty](https://twenty.com). Open-source, TypeScript, feito pra ser CRM. Pessoas, empresas, oportunidades, pipeline e responsável comercial vivem lá.

A integração entra como fronteira oficial do Montte, ao lado do PostHog. O Customer do Montte aponta pra Company ou Person no Twenty quando faz sentido.

Integrações oficiais são duas: PostHog e Twenty. O resto entra como adapter técnico.

## O Customer está virando outra coisa

O `Customer` no Montte deixa de carregar endereço, telefone e histórico de visita. Vira primitive de cobrança, no espírito do [Autumn](https://useautumn.com) e do [Polar](https://polar.sh).

Cinco verbos planejados pro runtime:

- `customers.getOrCreate` no signup ou login.
- `billing.attach` pra plugar plano ou produto no cliente.
- `entitlements.check` pra liberar funcionalidade por contrato.
- `usage.track` pra contar uso medido.
- `customers.state` pra puxar tudo numa chamada.

`customers.state` é a peça central. Devolve assinaturas, balances por meter, uso do período, faturas, status de pagamento, próximo reset e URL do portal. Quem integra renderiza uma página de billing com uma query.

## Posição

O Montte é runtime de billing usage-based brasileiro. Twenty resolve CRM por fora. Abacate Pay vai entrar como primeiro adapter de pagamento.

Referência de mercado deixa de ser Bling, Omie ou Conta Azul. Passa a ser Autumn, Polar e Stripe Billing.

## O que vem por aí

Waitlist aberta em [montte.com.br](https://montte.com.br/#waitlist). Manda DM se quiser testar antes do SDK público.
