---
title: "Montte Vault começa pelo GED"
description: "O Montte Vault começa como GED do produto: uma área para guardar NFS-e, contratos, comprovantes e documentos da empresa no mesmo lugar em que o founder já acompanha cobrança, uso, fatura e cliente. A primeira versão entrega pastas, lista de documentos, busca e upload visual."
publishedAt: 2026-06-14
author: "Manoel Neto"
tags: ["ged", "vault", "documentos", "fiscal"]
category: "Feature"
coverImage: "../../assets/blog/montte-vault-ged.png"
featured: true
readingMinutes: 3
keyTakeaways:
   - "Montte Vault começa como GED dentro do Montte."
   - "A primeira tela organiza documentos em pastas como Fiscal, Contratos e Empresa."
   - "A UI já tem busca, lista de documentos, resumo lateral e upload visual em Credenza."
   - "O próximo passo é ligar documentos aos módulos de NF-e, contratos e financeiro."
faq:
   - question: "O que é o Montte Vault?"
     answer: "Montte Vault é o início do GED do Montte, uma área para organizar documentos fiscais, contratos, comprovantes, anexos e arquivos da empresa dentro do mesmo produto."
   - question: "O Vault já armazena documentos?"
     answer: "A primeira versão entrega a interface, navegação por pastas, lista de documentos, busca, resumo lateral e fluxo visual de upload. A persistência completa dos documentos entra na próxima etapa do GED."
   - question: "Por que o GED fica dentro do Montte?"
     answer: "Porque documento fiscal, contrato e anexo operacional quase sempre pertencem a uma cobrança, cliente, fornecedor ou rotina financeira. O Montte guarda o arquivo perto desse contexto."
---

Montte Vault começou como uma tela pequena.

Colocamos uma rota nova no produto, `/$slug/$teamSlug/vault`, com pastas, busca, lista de documentos, resumo lateral e um fluxo visual de upload. Ainda não é o GED completo. É o primeiro corte da superfície que vai receber NFS-e, contratos, comprovantes e anexos da operação.

A razão veio de um incômodo simples: documento importante termina rápido demais em pasta errada. Uma nota fiscal fica no download. Um contrato vai para o Drive. Um comprovante some em conversa antiga. Depois alguém precisa fechar o mês e caça tudo de novo.

## Documento precisa carregar contexto

Um GED genérico guarda arquivo. O Montte Vault precisa guardar arquivo com contexto.

Uma NFS-e pertence a uma emissão. Um contrato pertence a um cliente ou fornecedor. Um comprovante pode pertencer a uma cobrança, centro de custo ou rotina financeira. Se o arquivo perde essa ligação, o time volta para planilha, pasta e mensagem antiga.

A gente quer cortar essa volta. O documento deve aparecer perto do fluxo que criou ou usou aquele arquivo.

## A primeira versão tem 4 peças

A UI inicial do Vault tem quatro peças visíveis.

- **Pastas:** começamos com Fiscal, Contratos e Empresa.
- **Lista:** documentos aparecem em itens compactos, no mesmo padrão visual do resto do Montte.
- **Busca:** a tela já reserva o lugar da busca documental.
- **Upload:** a ação de novo documento abre em Credenza, com nome, pasta e área de envio.

Nada disso finge que o backend documental já ficou pronto. A persistência, os metadados e as permissões entram depois. Preferimos subir a tela cedo para testar o formato antes de amarrar banco, armazenamento e vínculo entre módulos.

## Por que chamamos de Vault

Vault costuma lembrar cofre de segredo. No Montte, a palavra ficou maior que isso.

O cofre que uma empresa pequena precisa não guarda só token. Guarda XML, PDF, contrato, comprovante, cadastro, anexo de fornecedor e documento que alguém vai pedir na pior hora possível.

Esse é o recorte. Montte Vault é o cofre documental da operação.

## Onde ele encaixa no Montte

O Montte já puxa cobrança, uso, fatura e estado do cliente para o mesmo lugar. O Vault adiciona a parte documental desse fluxo.

Quando a NF-e emitir uma NFS-e, o arquivo deve cair no Vault. Quando a IA ler um contrato, o arquivo original e os campos extraídos devem ficar juntos. Quando o financeiro precisar de um comprovante, o anexo não deveria depender da memória de quem salvou.

Esse é o trabalho agora: ligar a UI aos módulos que já produzem ou consomem documentos.

## O que vem por aí

Vamos conectar upload real, armazenamento por espaço, metadados, permissões e vínculo com NF-e, contratos e financeiro.

Depois disso, o Vault deixa de ser uma tela de documentos e vira a memória operacional do Montte. Não é Bling, Omie ou Conta Azul. É mais uma peça da camada que falta no SaaS brasileiro pra facilitar a vida do founder.
