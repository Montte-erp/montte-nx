---
title: "Removemos o CRM. Empurramos pro Twenty."
description: "Tiramos 3.081 linhas de Contatos do Montte e mandamos relacionamento pro Twenty. O Customer virou primitive de cobrança, no estilo Autumn e Polar. O que sobra é runtime de billing usage-based para o Brasil, com Abacate Pay como adapter. O Montte deixou de ser ERP."
publishedAt: 2026-05-18
author: "Manoel Neto"
tags: ["opiniao", "crm", "billing", "twenty"]
category: "Opinião"
coverImage: "../../assets/blog/removemos-o-crm-cover.png"
featured: false
readingMinutes: 3
keyTakeaways:
  - "O Montte deixou de ter módulo de Contatos próprio."
  - "Relacionamento, pipeline e empresas vão pro Twenty, que é open-source e nasceu pra isso."
  - "O Customer no Montte virou primitive de cobrança, inspirado em Autumn e Polar."
  - "A posição mudou: o Montte é runtime de billing usage-based brasileiro, não ERP genérico."
faq:
  - question: "Por que o Montte não tem mais módulo de Contatos?"
    answer: "Porque CRM dentro de ERP é CRM ruim. A gente passou meses costurando properties panel, form sheet e ownership de contato achando que era diferencial. No fim, era cópia fraca de Pipedrive. Tiramos do produto e mandamos relacionamento pro Twenty, que faz isso direito."
  - question: "Onde fica o relacionamento com o cliente agora?"
    answer: "No Twenty. Pessoas, empresas, oportunidades, pipeline e responsável comercial vivem lá. O Montte integra como fronteira externa, não duplica."
  - question: "Então o Montte virou o quê?"
    answer: "Runtime de billing usage-based brasileiro, com Abacate Pay como adapter de pagamento. O Customer agrega assinaturas, uso, faturas e status de pagamento numa resposta só, no espírito do Autumn e do Polar."
---

Todo ERP brasileiro tem CRM nativo. O Montte tinha um também. Agora o CRM vai pro [Twenty](https://twenty.com), e o `Customer` virou outra coisa por aqui.

A gente passou meses construindo properties panel, form sheet, ownership middleware e a aba de contatos dentro de transações. Era CRM lite. CRM lite é CRM ruim.

## A tentação do CRM lite

Bling, Omie, Conta Azul e Tiny tratam relacionamento como parte do pacote. Faz sentido pra eles, é o jogo que jogam.

A gente olhou pro lado e seguiu o padrão por um tempo. A conta não fechou.

Cada release puxava regra nova, migração, fila de suporte, mais tela pra revisar. O módulo crescia, e nunca chegava num CRM de verdade. Pintou o dilema: dobrar a aposta e virar metade Pipedrive, ou aceitar que o lugar do relacionamento não era dentro do Montte.

Aceitamos. Tiramos 3.081 linhas em 37 arquivos. Doeu menos do que devia.

## Twenty cuida do que CRM faz bem

Twenty é open-source, escrito em TypeScript, e foi desenhado pra ser CRM. Não pra ser apêndice de ERP. Pessoas, empresas, oportunidades, pipeline, responsável comercial, tudo lá.

A integração entra como fronteira oficial do Montte, junto do PostHog. Nada de marketplace de CRMs. Nada de "também temos pipeline aqui". O Customer do Montte aponta pra Company ou Person do Twenty quando faz sentido, e o que é CRM nunca volta pra dentro.

A regra interna é curta: integrações oficiais são duas, PostHog e Twenty. O resto entra como adapter técnico.

## Customer virou primitive de cobrança

A parte que ficou no Montte mudou de natureza. `Customer` não é mais entidade de CRM com endereço, telefone e histórico de visita. Virou primitive de billing, no estilo do [Autumn](https://useautumn.com) e do [Polar](https://polar.sh).

Cinco verbos cobrem o runtime:

- `customers.getOrCreate` no signup ou login.
- `billing.attach` pra plugar plano ou produto.
- `entitlements.check` pra liberar funcionalidade por contrato.
- `usage.track` pra contar uso medido.
- `customers.state` pra puxar tudo numa chamada.

`customers.state` é a peça central. Devolve assinaturas ativas, balances por meter, uso do período, faturas recentes, status de pagamento, próximo reset e URL do portal. Quem integra renderiza uma billing page com uma query.

Esse é o desenho que faltava. CRM nunca foi.

## O Montte virou Autumn brasileiro

Em uma frase: o Montte é runtime de billing usage-based para o Brasil, com Abacate Pay como adapter de pagamento e Twenty como CRM oficial fora dele.

Concorrente real deixa de ser Bling, Omie ou Conta Azul. Passa a ser Autumn, Polar e Stripe Billing. É o terreno onde queremos brigar, e onde ainda não existe opção brasileira nativa.

ERP genérico, plataforma faz-tudo, "também temos CRM": passamos longe. Quem quer pipeline abre o Twenty. Quem precisa cobrar uso, recorrência ou plano gradeado, abre o Montte.

## O que vem por aí

A próxima parada é abrir a waitlist do Montte Payments e publicar o SDK. Se quiser entrar primeiro, [a fila tá aberta em montte.com.br](https://montte.com.br).
