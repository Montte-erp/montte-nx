---
title: "Removemos o CRM. Empurramos pro Twenty."
description: "O Montte tirou o módulo de Contatos do produto: 3.081 linhas em 37 arquivos. Relacionamento agora aponta pra fora, com a integração com o Twenty planejada como fronteira oficial. O Customer está virando primitive de cobrança, no espírito do Autumn e do Polar. O destino é runtime de billing brasileiro."
publishedAt: 2026-05-18
author: "Manoel Neto"
tags: ["opiniao", "crm", "billing", "twenty"]
category: "Opinião"
coverImage: "../../assets/blog/removemos-o-crm-cover.png"
featured: false
readingMinutes: 3
keyTakeaways:
   - "O módulo de Contatos saiu do produto: 3.081 linhas em 37 arquivos."
   - "Relacionamento aponta pra fora. Integração com o Twenty está no roadmap como fronteira oficial."
   - "O Customer no Montte está virando primitive de cobrança, inspirado em Autumn e Polar."
   - "Posição: o Montte é runtime de billing usage-based brasileiro, não ERP."
faq:
   - question: "Por que o Montte não tem mais módulo de Contatos?"
     answer: "Porque CRM dentro de produto que não é CRM acaba virando CRM pela metade. O lugar do relacionamento é em ferramenta dedicada. No Montte, o destino do Customer é cobrança, não pipeline."
   - question: "A integração com o Twenty já está pronta?"
     answer: "Ainda não. Está planejada como fronteira oficial do Montte, ao lado do PostHog. O escopo inicial é mapear o Customer do Montte para Company ou Person no Twenty, sem trazer CRM de volta pra dentro."
   - question: "Então o Montte virou o quê?"
     answer: "Runtime de billing usage-based brasileiro, no espírito do Autumn e do Polar. O Customer vai agregar assinaturas, uso, faturas e status de pagamento numa resposta só. Tem peça por construir, e a gente conta em público conforme entrega."
---

O Montte tirou o módulo de Contatos do produto. Foram 3.081 linhas em 37 arquivos. O lugar do relacionamento agora é fora do Montte, com a integração com o Twenty planejada como fronteira oficial. Por dentro, o Customer está mudando de natureza: deixa de ser entidade de CRM e vira primitive de cobrança.

## O que saiu

Saíram da superfície router de contatos, formulário, painel de propriedades, listagem, colunas, settings de contato, aba de contatos dentro de transações e o passo correspondente no onboarding. A coluna `contactId` em transações fica como resíduo de schema pra ser removida em seguida.

A decisão é de produto, não de bug. O módulo funcionava. Não era o lugar certo pra ele viver.

## CRM dentro do Montte virou ruído

CRM dentro de produto que não é CRM acaba virando CRM pela metade. A cada ajuste em outra área, o módulo de Contatos puxava regra nova, migração, fila de suporte e mais tela pra revisar. Crescia, e nunca alcançava um Pipedrive de verdade.

Levou alguns meses pra confirmar. A primeira aposta foi reforçar properties panel, form sheet e ownership middleware achando que esse seria um diferencial real. Não era. Tiramos.

## Para onde o relacionamento vai

A direção é [Twenty](https://twenty.com). Open-source, escrito em TypeScript, desenhado pra ser CRM e não apêndice. Pessoas, empresas, oportunidades, pipeline e responsável comercial vivem lá.

A integração ainda não foi construída. Está planejada como fronteira oficial do Montte, ao lado do PostHog. Quando entrar, o Customer do Montte vai apontar pra Company ou Person no Twenty, e o que é CRM nunca volta pra dentro.

Integrações oficiais são duas: PostHog e Twenty. O resto entra como adapter técnico.

## O que o Customer está virando

A parte que ficou no Montte muda de natureza. O `Customer` deixa de ser entidade de CRM com endereço, telefone e histórico de visita. Vira primitive de cobrança, no espírito do [Autumn](https://useautumn.com) e do [Polar](https://polar.sh).

O desenho do runtime tem cinco verbos planejados:

- `customers.getOrCreate` no signup ou login.
- `billing.attach` pra plugar plano ou produto no cliente.
- `entitlements.check` pra liberar funcionalidade por contrato.
- `usage.track` pra contar uso medido.
- `customers.state` pra puxar tudo numa chamada.

`customers.state` é a peça central. Devolve assinaturas ativas, balances por meter, uso do período, faturas recentes, status de pagamento, próximo reset e URL do portal. Quem integrar renderiza uma página de billing com uma query.

Essa é a forma do Customer que faltava. CRM nunca foi.

## Posição

O Montte é runtime de billing usage-based brasileiro. Twenty resolve CRM por fora. Quando o gateway entrar, vai ser via adapter de pagamento, começando pelo Abacate Pay.

A referência de mercado deixa de ser Bling, Omie ou Conta Azul, que jogam o jogo de ERP completo. Passa a ser Autumn, Polar e Stripe Billing. É o terreno onde queremos competir, e onde ainda não existe opção brasileira nativa.

## O que vem por aí

A waitlist do Montte já está aberta. Entra em [montte.com.br](https://montte.com.br/#waitlist) e manda DM se quiser testar antes do SDK público.
