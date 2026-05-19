---
title: "Removemos o CRM. Empurramos pro Twenty."
description: "O Montte tirou o módulo de Contatos: 3.081 linhas em 37 arquivos. Relacionamento passa a viver no Twenty, que é o CRM que a gente já usa por dentro. O Customer está virando a primitiva de cobrança por uso. O Montte é a camada que falta no SaaS brasileiro pra facilitar a vida do founder."
publishedAt: 2026-05-18
author: "Manoel Neto"
tags: ["opiniao", "crm", "billing", "twenty"]
category: "Opinião"
coverImage: "../../assets/blog/removemos-o-crm-cover.png"
featured: false
readingMinutes: 3
keyTakeaways:
   - "Módulo de Contatos saiu: 3.081 linhas em 37 arquivos."
   - "Relacionamento passa a viver no Twenty. Integração entra como primeira da fila porque o Montte já usa por dentro."
   - "O Customer vira a primitiva de cobrança por uso."
   - "Montte é camada de billing, não ERP."
faq:
   - question: "Por que o Montte não tem mais módulo de Contatos?"
     answer: "Relacionamento mora em CRM. No Montte, o Customer existe pra cobrança."
   - question: "A integração com o Twenty já está pronta?"
     answer: "Ainda não. É a primeira da fila porque o Twenty é o CRM que a gente usa por dentro. Escopo inicial: mapear o Customer pra Company ou Person no Twenty."
   - question: "Então o Montte virou o quê?"
     answer: "Camada de billing. Assinatura, uso medido, fatura e status de pagamento juntos numa resposta. O desenho da API ainda está aberto."
---

Tinha um módulo de Contatos no Montte. Não tem mais. Saíram 3.081 linhas em 37 arquivos. Relacionamento passa a viver fora, com a integração com o Twenty no roadmap.

## O que saiu

Router de contatos, formulário, painel de propriedades, listagem, colunas, settings, passo no onboarding e a aba de contatos dentro de transações. A coluna `contactId` em transações é o resíduo de schema, sai junto na sequência.

O módulo funcionava. O problema era de posição.

## Por que saiu

Cada ajuste em outra área puxava regra nova no Contatos, migração, mais tela pra revisar. CRM dentro de produto que não nasceu pra ser CRM sempre fica pela metade.

A escolha aqui é antiga. Ou se assume metade, ou se delega o relacionamento pra uma ferramenta dedicada. A gente delega.

## Onde o relacionamento vai morar

[Twenty](https://twenty.com). Open-source, TypeScript, feito pra ser CRM. Pessoas, empresas, oportunidades, pipeline e responsável comercial vivem lá.

É a primeira integração planejada do Montte, porque o Twenty é o CRM que a gente já usa internamente pra rodar o próprio negócio. O Customer do Montte vai apontar pra Company ou Person no Twenty quando fizer sentido.

## O Customer está virando outra coisa

O `Customer` no Montte deixa de carregar endereço, telefone e histórico de visita. Vira a primitiva de cobrança por uso.

O que sobra de dados pessoais é o mínimo pra identificar o cliente brasileiro: CPF quando é pessoa física, CNPJ quando é pessoa jurídica. Isso decide como o registro entra no Twenty: CPF vira Person, CNPJ vira Company. O resto do perfil mora lá.

A ideia é que o Customer carregue assinaturas, uso medido, faturas, status de pagamento e estado do plano numa resposta só. Em vez de cinco endpoints, uma chamada que devolve tudo que a página de billing precisa renderizar.

O formato exato dessa API ainda está em aberto. É sobre isso que a gente quer ouvir a comunidade antes de cravar.

## Ajuda a desenhar a DX

Tem um survey aberto pra quem já bateu de frente com billing em SaaS. Três perguntas curtas: como você imagina a DX dessa camada, o que você usa hoje (Polar, Stripe Billing, Lago, Orb, plano próprio em planilha) e o que te trava quando precisa entregar cobrança por uso.

[Responder o survey](https://us.posthog.com/external_surveys/019e3db6-1650-0000-9810-32389338ce6a)

Quanto mais resposta com exemplo concreto, mais fácil fica fechar o desenho. A intenção é publicar de volta o que sair do survey num próximo post.

## Posição

O Montte cuida de assinatura, uso medido, cobrança e estado do cliente. Twenty resolve CRM por fora. Abacate Pay entra como primeiro adapter de pagamento.

Não é Bling, Omie ou Conta Azul.

## O que vem por aí

Tem [waitlist aberta](https://montte.com.br/#waitlist) pra quem quiser acompanhar de perto. O resultado do survey de DX sai num próximo post.
