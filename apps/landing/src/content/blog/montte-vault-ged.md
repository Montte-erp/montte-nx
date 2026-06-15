---
title: "GED no Montte"
description: "O Montte Vault guarda documentos no mesmo lugar em que a operação acontece: upload manual, pastas por workspace e anexos financeiros na pasta Anexos."
publishedAt: 2026-06-14
author: "Manoel Neto"
tags: ["ged", "vault", "documentos", "fiscal"]
category: "Feature"
coverImage: "../../assets/blog/montte-vault-ged.png"
featured: true
readingMinutes: 2
keyTakeaways:
   - "Montte Vault é o GED do Montte."
   - "Arquivos enviados pelo Vault usam o prefixo vault-documents no bucket."
   - "A pasta padrão é Anexos. O usuário cria as outras."
   - "Anexos financeiros já aparecem no GED."
faq:
   - question: "O que é o Montte Vault?"
     answer: "É o GED do Montte: documentos, comprovantes e anexos ligados aos fluxos do produto."
   - question: "Quais pastas vêm por padrão?"
     answer: "Só Anexos. O usuário cria outras pastas no sheet de novo documento."
   - question: "O Vault já recebe anexos financeiros?"
     answer: "Sim. Anexos de lançamentos financeiros entram no Vault automaticamente."
---

Um comprovante anexado no financeiro não deveria morrer dentro do lançamento.

Ele continua ali, porque o lançamento precisa do comprovante. Mas ele também precisa aparecer no GED, onde alguém procura documento depois.

Esse foi o primeiro corte do Montte Vault.

Criamos a rota `/vault`, o schema `vault`, o módulo backend e o upload para `vault-documents`. A tela tem tabela, busca, filtros, seleção, bulk archive e ação para abrir arquivo.

No sheet de novo documento, o usuário envia o arquivo, escreve nome e descrição, escolhe uma pasta ou cria uma nova. O Montte cria uma única pasta padrão: **Anexos**.

Cortamos as pastas prontas Fiscal, Contratos e Empresa. Era organização inventada por nós. Se o time precisa dessas pastas, ele cria.

## O financeiro já escreve no GED

Anexo de lançamento financeiro agora vira documento do Vault.

O arquivo usa o mesmo namespace `vault-documents` no bucket. O backend registra título, descrição, origem `Financeiro`, status e pasta **Anexos** em `vault.documents`.

Na prática:

- o financeiro mantém o anexo no lançamento;
- o Vault lista o mesmo arquivo como documento;
- update de lançamento não duplica documento com o mesmo `fileKey`.

## O que falta

NF-e e NFS-e ainda precisam escrever XML e PDF no Vault.

Contratos precisam guardar o arquivo original. Extrações precisam apontar para o documento usado. Depois disso, o GED deixa de ser só uma lista de arquivos e vira índice dos documentos que passam pelo Montte.

Esse PR entrega o início: upload manual, pasta **Anexos**, bucket, banco, backend e anexos financeiros entrando no GED.
