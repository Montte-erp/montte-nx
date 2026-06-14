---
title: "Montte Vault começa pelo GED"
description: "O Montte Vault nasceu como GED dentro do produto: documentos no bucket, metadados no backend, pastas criadas pelo usuário e anexos financeiros entrando automaticamente na pasta Anexos."
publishedAt: 2026-06-14
author: "Manoel Neto"
tags: ["ged", "vault", "documentos", "fiscal"]
category: "Feature"
coverImage: "../../assets/blog/montte-vault-ged.png"
featured: true
readingMinutes: 3
keyTakeaways:
   - "Montte Vault começa como GED real dentro do Montte, não como mock de UI."
   - "Uploads já vão para o bucket e são registrados no backend do Vault."
   - "A primeira pasta padrão é Anexos, usada também pelos anexos financeiros."
   - "O usuário pode escolher ou criar uma pasta ao adicionar um documento."
faq:
   - question: "O que é o Montte Vault?"
     answer: "Montte Vault é o início do GED do Montte: uma área para guardar documentos, comprovantes, anexos e arquivos operacionais dentro do mesmo produto onde a empresa já controla financeiro, fiscal e rotinas do time."
   - question: "O Vault já armazena documentos?"
     answer: "Sim. A primeira versão já envia arquivos para o bucket, registra metadados no backend, lista documentos em uma data table e permite organizar arquivos por pasta."
   - question: "Quais pastas vêm por padrão?"
     answer: "Apenas Anexos. Outras pastas são criadas pelo usuário no próprio fluxo de novo documento."
   - question: "O Vault já conversa com outros módulos?"
     answer: "Sim. Anexos de lançamentos financeiros já são registrados no Vault automaticamente, na pasta Anexos."
---

Montte Vault começou do jeito certo: pequeno, mas conectado.

A primeira versão não é uma tela falsa esperando o backend chegar depois. Já existe schema no banco, módulo backend, rota no app, upload para o bucket e integração com anexos financeiros. O usuário abre `/$slug/$teamSlug/vault`, vê uma tabela de documentos e consegue adicionar arquivo com nome, descrição e pasta.

Parece simples. Era para ser.

O problema que o Vault resolve também é simples: documento importante some rápido demais.

Um comprovante fica preso em um lançamento. Um XML fica na pasta de downloads. Um PDF vai para o Drive de alguém. Depois, na hora de fechar uma pendência, conferir uma cobrança ou responder uma solicitação, o time precisa procurar o arquivo fora do fluxo onde ele nasceu.

O Vault começa para cortar esse caminho.

## GED dentro do fluxo, não uma gaveta separada

Um GED genérico guarda arquivo.

O Montte Vault precisa guardar arquivo com contexto.

Se um anexo veio de um lançamento financeiro, ele não deveria existir só no financeiro. Ele também deve aparecer no lugar onde a empresa procura documentos. Por isso, anexos de lançamentos agora entram automaticamente no Vault, na pasta **Anexos**.

Esse detalhe importa. O Vault não começa como uma biblioteca vazia que depende de disciplina manual. Ele já recebe documento de um fluxo operacional real.

## O que entrou nesta primeira versão

A primeira versão do Vault tem a base que precisava existir antes de qualquer automação maior.

- **Backend próprio:** módulo `vault` com rotas para listar pastas, criar pasta, listar documentos, criar documento e arquivar em lote.
- **Banco próprio:** schema `vault` com tabelas de pastas e documentos.
- **Upload real:** arquivos enviados pelo Vault vão para o bucket em `vault-documents`.
- **Tabela padrão do app:** documentos aparecem em data table com busca, filtros, paginação, seleção e actions.
- **Pastas do usuário:** ao criar documento, o usuário escolhe uma pasta ou cria uma nova no próprio campo.
- **Pasta padrão única:** começamos só com **Anexos**. Fiscal, Contratos e Empresa não são pastas mágicas por padrão.
- **Integração financeira:** anexos de lançamentos financeiros são registrados no Vault sem trabalho extra.

A decisão de ter apenas Anexos como pasta padrão foi proposital. Pastas como Fiscal, Contratos, Cliente ou Fornecedor dependem do jeito que cada empresa trabalha. O produto não precisa inventar essa organização cedo demais.

## A tela segue o padrão operacional do Montte

O Vault usa a mesma lógica das telas de operação do Montte: header simples, tabela, toolbar, filtros, paginação e painel de contexto à direita.

A ação de novo documento fica na toolbar, não no header. O formulário abre em sheet. O upload mostra progresso. O documento tem nome e descrição separados. As ações da linha ficam em icon buttons.

Isso parece detalhe visual, mas evita uma categoria inteira de tela que nasce bonita e morre diferente do resto do produto.

Vault é operação. A UI precisa parecer operação.

## Por que chamar de Vault

Vault lembra cofre de segredo. No Montte, o cofre começa pelos documentos da empresa.

Não é só token, chave ou credencial. É comprovante, PDF, XML, contrato, anexo e arquivo que alguém vai precisar encontrar quando a operação apertar.

O nome ficou porque a ambição é essa: um lugar confiável para guardar o que não pode se perder.

## O próximo passo

Agora que o básico existe de ponta a ponta, o trabalho muda.

O Vault precisa receber documentos de mais módulos. NF-e e NFS-e devem cair ali. Contratos devem guardar arquivo original e metadados extraídos. Documentos precisam ganhar vínculos melhores com cliente, fornecedor, lançamento, cobrança e rotina fiscal.

Essa primeira versão não tenta resolver tudo. Ela coloca a fundação no lugar certo: arquivo no bucket, metadado no banco, pasta no produto e documento aparecendo onde o time já trabalha.

É assim que o Montte Vault começa pelo GED.
