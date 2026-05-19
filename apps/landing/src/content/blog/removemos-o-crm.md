---
title: "Removemos o CRM. Empurramos pro Twenty."
description: "O Montte nunca foi ERP, mas mantinha um módulo de Contatos que dava essa impressão. Tiramos 3.081 linhas. Relacionamento vai pro Twenty quando a integração ficar pronta. O Customer está virando primitive de cobrança, no estilo Autumn e Polar. O destino é runtime de billing brasileiro."
publishedAt: 2026-05-18
author: "Manoel Neto"
tags: ["opiniao", "crm", "billing", "twenty"]
category: "Opinião"
coverImage: "../../assets/blog/removemos-o-crm-cover.png"
featured: false
readingMinutes: 3
keyTakeaways:
  - "O módulo de Contatos saiu do Montte (3.081 linhas, 37 arquivos)."
  - "O destino do relacionamento é o Twenty, que é open-source e nasceu pra isso. Integração no roadmap."
  - "O Customer no Montte está virando primitive de cobrança, inspirado em Autumn e Polar."
  - "Posição: o Montte é runtime de billing usage-based brasileiro, não ERP."
faq:
  - question: "Por que o Montte não tem mais módulo de Contatos?"
    answer: "Porque CRM dentro de produto que não é CRM é CRM ruim. A gente passou meses costurando properties panel, form sheet e ownership de contato achando que era diferencial. No fim, era cópia fraca de Pipedrive. Tiramos do produto e o destino do relacionamento é o Twenty."
  - question: "A integração com o Twenty já está pronta?"
    answer: "Ainda não. Está planejada como fronteira oficial do Montte, junto do PostHog. O escopo inicial é mapear o Customer do Montte pra Company ou Person do Twenty, sem trazer CRM de volta pra dentro."
  - question: "Então o Montte virou o quê?"
    answer: "Está virando runtime de billing usage-based brasileiro, no espírito do Autumn e do Polar. O Customer vai agregar assinaturas, uso, faturas e status de pagamento numa resposta só. Tem peça por construir, e a gente vai contando em público conforme entrega."
---

Quase todo ERP brasileiro tem CRM nativo. O Montte nunca foi ERP, mas mantinha um módulo de Contatos por dentro. Era o tipo de coisa que dava margem pra confusão. Não está mais lá.

A gente passou meses construindo properties panel, form sheet, ownership middleware e a aba de contatos dentro de transações. Era CRM lite. CRM lite é CRM ruim.

## A tentação do CRM lite

Bling, Omie, Conta Azul e Tiny tratam relacionamento como parte do pacote. Faz sentido pra eles, é o jogo que jogam.

A gente olhou pro lado e seguiu o padrão por um tempo. A conta não fechou.

Cada release puxava regra nova, migração, fila de suporte, mais tela pra revisar. O módulo crescia e nunca chegava num CRM de verdade. Pintou o dilema: dobrar a aposta e virar metade Pipedrive, ou aceitar que o lugar do relacionamento não era dentro do Montte.

Aceitamos. Tiramos 3.081 linhas em 37 arquivos. Doeu menos do que devia.

## O destino do relacionamento é o Twenty

[Twenty](https://twenty.com) é open-source, escrito em TypeScript, e foi desenhado pra ser CRM. Não pra ser apêndice de outro produto. Pessoas, empresas, oportunidades, pipeline, responsável comercial, tudo lá.

A integração com o Twenty ainda não foi construída. Está planejada como fronteira oficial do Montte, ao lado do PostHog. Nada de marketplace de CRMs. Nada de "também temos pipeline aqui". Quando entrar, o Customer do Montte vai apontar pra Company ou Person do Twenty, e o que é CRM nunca volta pra dentro.

A regra interna é curta: integrações oficiais são duas, PostHog e Twenty. O resto é adapter técnico.

## Customer está virando primitive de cobrança

A parte que ficou no Montte está mudando de natureza. `Customer` deixa de ser entidade de CRM com endereço, telefone e histórico de visita. Vira primitive de billing, no estilo do [Autumn](https://useautumn.com) e do [Polar](https://polar.sh).

O desenho que está sendo construído tem cinco verbos:

- `customers.getOrCreate` no signup ou login.
- `billing.attach` pra plugar plano ou produto.
- `entitlements.check` pra liberar funcionalidade por contrato.
- `usage.track` pra contar uso medido.
- `customers.state` pra puxar tudo numa chamada.

`customers.state` é a peça central planejada. A ideia é devolver assinaturas ativas, balances por meter, uso do período, faturas recentes, status de pagamento, próximo reset e URL do portal. Quem integrar renderiza uma billing page com uma query.

Esse é o desenho que faltava. CRM nunca foi.

## O destino é o Autumn brasileiro

Em uma frase: o Montte é runtime de billing usage-based brasileiro. O gateway inicial vai ser o Abacate Pay, plugado como adapter de pagamento. Twenty fica como CRM oficial fora dele.

Concorrente real não é Bling, Omie ou Conta Azul. É Autumn, Polar e Stripe Billing. É o terreno onde queremos brigar, e onde ainda não existe opção brasileira nativa.

ERP genérico, plataforma faz-tudo, "também temos CRM": passamos longe. Quem quer pipeline abre o Twenty. Quem precisa cobrar uso, recorrência ou plano gradeado, vai poder abrir o Montte.

## O que vem por aí

A waitlist do Montte Payments já está aberta. O próximo passo é publicar o SDK em fases. Se quiser entrar primeiro, [entra na fila em montte.com.br](https://montte.com.br/#waitlist).
