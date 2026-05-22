---
title: "Automações de relatórios chegaram"
description: "O Montte agora agenda relatórios financeiros sem tarefa manual: DRE, fluxo de caixa, despesas por Centro de Custo, vencimentos e categorias podem nascer de uma automação mensal ou semanal. A primeira versão inclui modelos prontos, histórico de execuções, pausa, ativação e edição de agenda pela própria tela."
publishedAt: 2026-05-22
author: "Manoel Neto"
tags: ["feature", "automacoes", "relatorios", "financeiro"]
category: "Feature"
coverImage: "../../assets/blog/montte-2026-05-22.jpg"
featured: false
readingMinutes: 4
keyTakeaways:
   - "Automações agora geram relatórios financeiros por agenda semanal ou mensal."
   - "A primeira versão tem modelos para DRE, fluxo de caixa, despesas por Centro de Custo, vencimentos e categorias."
   - "Cada automação mostra agenda, status, próxima execução e histórico recente."
   - "Automações em branco começam pausadas até serem configuradas."
faq:
   - question: "O que as automações do Montte fazem nesta primeira versão?"
     answer: "Elas geram relatórios financeiros automaticamente a partir de uma agenda semanal ou mensal."
   - question: "Quais relatórios podem ser automatizados?"
     answer: "A primeira versão inclui DRE, fluxo de caixa, despesas por Centro de Custo, a receber e pagar, e despesas por categoria."
   - question: "Posso criar uma automação do zero?"
     answer: "Sim. A automação em branco nasce pausada para você configurar agenda e relatório antes de ativar."
---

O Montte agora agenda relatórios financeiros. DRE, fluxo de caixa, despesas por Centro de Custo, vencimentos e categorias podem nascer sem alguém lembrar de clicar no mesmo botão todo mês.

A primeira versão é simples de propósito: você escolhe um modelo, confere a agenda, ativa e acompanha as execuções.

## O problema é o fechamento manual

Relatório recorrente quase nunca é difícil por causa do relatório. Ele é chato porque volta sempre.

Todo dia 1, toda segunda-feira, todo fechamento de mês. Alguém precisa lembrar, abrir a tela certa, escolher o período certo e repetir a operação. Se passar batido, o atraso aparece na reunião, não no sistema.

## Como funciona no produto

A tela de automações começa com modelos prontos. Tem DRE mensal, fluxo de caixa semanal, despesas por Centro de Custo, a receber e pagar semanal, e despesas por categoria.

Você também pode começar em branco. Nesse caso, a automação nasce pausada. Parece detalhe, mas evita o pior tipo de automação: aquela que roda antes de alguém terminar de configurar.

## Dentro da tela de automação

Cada automação tem 2 blocos principais: quando executar e o que gerar.

No bloco de agenda, você define repetição semanal ou mensal, dia e horário. No bloco de relatório, você define o tipo, o período usado no cálculo e o nome gerado.

Também dá pra ver o histórico recente de execuções. Se uma execução falhar, o erro aparece ali, no contexto da automação.

## Por baixo do capô

A primeira versão tem 2 tipos de nó: agenda e criação de relatório. Isso mantém a tela pequena e previsível.

A parte que parecia simples deu trabalho. A primeira tentativa de criação otimista abria uma URL local antes de o servidor confirmar o identificador real. Corrigimos isso para a navegação usar o UUID criado no servidor.

As execuções rodam pelo processo de segundo plano. Se o agendamento não conseguir iniciar a execução, o Montte marca a execução como falha e calcula a próxima tentativa da agenda.

## O que vem por aí

O próximo passo é ampliar o que uma automação pode fazer além de gerar relatório. Primeiro, queremos deixar essa base confiável: criar, pausar, ativar, acompanhar falha e não rodar nada antes da configuração estar pronta.

Tem [waitlist aberta](https://montte.com.br/#waitlist) pra quem quiser acompanhar essa base de automações de perto.
