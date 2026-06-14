---
title: "Montte Vault começa pelo GED"
description: "O Montte Vault inicia o GED do produto: uma área para guardar documentos fiscais, contratos, anexos e arquivos da empresa no mesmo lugar em que o founder já acompanha cobrança, uso, fatura e estado do cliente. A primeira versão entrega navegação, pastas e upload preparado."
publishedAt: 2026-06-14
author: "Manoel Neto"
tags: ["ged", "vault", "documentos", "fiscal"]
category: "Feature"
coverImage: "../../assets/blog/montte-vault-ged.png"
featured: true
readingMinutes: 3
keyTakeaways:
   - "Montte Vault é o começo do GED dentro do Montte."
   - "A primeira tela organiza documentos por pastas como Fiscal, Contratos e Empresa."
   - "O upload já tem fluxo visual preparado para receber o backend do GED."
   - "A direção é ligar documentos ao fluxo operacional, não criar uma pasta solta."
faq:
   - question: "O que é o Montte Vault?"
     answer: "Montte Vault é o início do GED do Montte, uma área para organizar documentos fiscais, contratos, anexos e arquivos da empresa dentro do mesmo produto."
   - question: "O Vault já armazena documentos?"
     answer: "A primeira versão entrega a interface, navegação, pastas e o fluxo visual de upload. A persistência completa dos documentos entra na próxima etapa do GED."
   - question: "Por que o GED fica dentro do Montte?"
     answer: "Porque documento fiscal, contrato e anexo operacional quase sempre pertencem a uma cobrança, cliente, fornecedor ou rotina financeira. O Montte quer guardar esse contexto junto do arquivo."
---

O Montte Vault é o começo do nosso GED.

A primeira versão é simples de propósito: uma tela para organizar documentos fiscais, contratos e arquivos da empresa dentro do Montte. Sem vender uma central documental gigante antes de ter o fluxo certo.

A gente precisava de um lugar para onde uma NFS-e emitida, um contrato assinado e um comprovante da empresa pudessem ir sem virar pasta perdida no Drive. Esse lugar agora tem nome.

## O GED começa onde o trabalho já acontece

O Vault nasce dentro do produto porque documento solto vira trabalho dobrado. Você baixa um PDF, salva em uma pasta, renomeia, manda para alguém e depois tenta lembrar se aquele arquivo pertence a um cliente, fornecedor, fatura ou centro de custo.

No Montte, a direção é outra. Documento precisa nascer perto do contexto operacional.

Uma nota fiscal pertence a uma emissão. Um contrato pertence a uma relação comercial. Um anexo pode pertencer a uma cobrança, fornecedor ou rotina interna. O Vault começa como a superfície que vai juntar essas peças.

## A primeira tela é um esqueleto honesto

Esta primeira versão adiciona uma rota própria no produto: `/$slug/$teamSlug/vault`.

Ela tem três partes:

- **Pastas:** Fiscal, Contratos e Empresa aparecem como estrutura inicial.
- **Documentos:** a lista usa o mesmo padrão visual de itens compactos do Montte.
- **Resumo:** um painel lateral mostra a leitura geral do acervo.

Também colocamos a ação de novo documento em uma Credenza. O upload ainda é visual, sem persistência completa no backend. Preferimos deixar isso claro agora em vez de fingir que o GED inteiro ficou pronto em uma tarde.

## Por que chamar de Vault

A palavra "vault" costuma lembrar segredo, chave e cofre. Isso ainda faz sentido para o Montte, mas não é a história toda.

No nosso caso, Vault é cofre operacional. Ele guarda o que sustenta a operação: XML, PDF, contrato, comprovante, arquivo cadastral e qualquer documento que precisa ficar junto do fluxo de trabalho.

A diferença é contexto. Uma pasta genérica guarda arquivo. O Vault do Montte precisa guardar arquivo com ligação ao resto da operação.

## O que vem por aí

A próxima etapa é ligar a interface ao backend do GED: upload real, armazenamento por espaço, metadados, permissões e vínculo com módulos como NF-e e contratos.

Depois disso, a parte interessante começa. Documento fiscal emitido no Montte deve aparecer no Vault sem download manual. Contrato analisado por IA deve guardar o arquivo original e os campos extraídos. Anexo de fornecedor deve ficar acessível sem caçada em conversa antiga.

Não é Bling, Omie ou Conta Azul. É o Montte construindo a camada que falta no SaaS brasileiro pra facilitar a vida do founder.
