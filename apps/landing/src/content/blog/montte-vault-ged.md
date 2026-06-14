---
title: "Montte Vault: o GED do Montte"
description: "Criamos o GED do Montte: upload no bucket, documentos no banco, pastas por workspace e anexos financeiros aparecendo em Anexos."
publishedAt: 2026-06-14
author: "Manoel Neto"
tags: ["ged", "vault", "documentos", "fiscal"]
category: "Feature"
coverImage: "../../assets/blog/montte-vault-ged.png"
featured: true
readingMinutes: 2
keyTakeaways:
   - "Montte Vault é o GED do Montte."
   - "O upload salva no bucket e cria o documento no backend."
   - "A única pasta padrão é Anexos."
   - "Anexos de lançamentos financeiros já entram no Vault."
faq:
   - question: "O que é o Montte Vault?"
     answer: "É o GED do Montte. Ele guarda documentos, anexos, comprovantes e arquivos ligados aos fluxos do produto."
   - question: "O Vault já salva arquivos?"
     answer: "Sim. O arquivo vai para o bucket e o documento é registrado no schema vault."
   - question: "Quais pastas vêm por padrão?"
     answer: "Só Anexos. As outras pastas são criadas pelo usuário no fluxo de novo documento."
   - question: "O Vault já recebe arquivos de outros módulos?"
     answer: "Sim. Anexos de lançamentos financeiros entram no Vault automaticamente."
---

Criamos o GED do Montte.

Ele se chama Montte Vault.

A primeira versão faz o básico sem fingir produto pronto: envia arquivo para o bucket, grava documento no banco e mostra a lista em `/$slug/$teamSlug/vault`.

O usuário adiciona um documento pelo sheet, preenche nome e descrição, escolhe uma pasta ou cria uma nova no mesmo campo. A tabela mostra nome, descrição, pasta, status, origem e a ação de abrir o arquivo.

Só existe uma pasta padrão: **Anexos**.

A gente chegou a considerar pastas prontas como Fiscal, Contratos e Empresa. Cortamos. Isso parecia organização, mas era só opinião nossa dentro do workspace do cliente. Se o time quer uma pasta chamada Contratos, ele cria. Se quer Cliente, Fornecedor, 2026 ou Banco, também cria.

## O primeiro uso veio do financeiro

O primeiro módulo conectado ao Vault foi o financeiro.

Quando alguém adiciona anexo em um lançamento, o Montte registra o arquivo no Vault. Ele aparece em **Anexos**.

Isso muda uma rotina pequena. O comprovante continua no lançamento, onde faz sentido na hora de conferir a despesa. Mas ele também fica no GED, onde faz sentido na hora de procurar documento.

Antes, o anexo era detalhe de uma tela. Agora ele também é documento da empresa.

## O que foi implementado

No banco, adicionamos o schema `vault` com pastas e documentos.

No backend, criamos rotas para listar pastas, criar pasta, listar documentos, criar documento, buscar resumo e arquivar documentos em lote.

No upload, adicionamos a rota `vaultDocument`. Ela aceita PDF, XML, JSON, texto, imagem e documentos Office, com limite de 25 MB, e salva usando o prefixo `vault-documents`.

No app, a tela usa o padrão das tabelas do Montte: busca, filtros de coluna, paginação, seleção, bulk action e ações por ícone. O painel da direita explica o contexto sem roubar espaço da tabela.

## O que vem depois

O Vault ainda precisa receber documentos de mais lugares.

NF-e e NFS-e devem gravar XML e PDF ali. Contratos devem guardar o arquivo original. Extrações e automações precisam apontar para o documento que usaram.

Esse é o caminho: o arquivo fica no GED, mas continua ligado ao fluxo que criou o arquivo.

Montte Vault é o GED do Montte. Começa por upload manual e anexos financeiros.
