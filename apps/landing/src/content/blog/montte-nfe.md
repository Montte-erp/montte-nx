---
title: "NF-e no Montte"
description: "O Montte ganhou o primeiro corte de NF-e: rota própria, tabela operacional, configuração do portal jacobina-saatri e aviso automático quando o espaço ainda não tem credenciais fiscais."
publishedAt: 2026-06-15
author: "Manoel Neto"
tags: ["nfe", "fiscal", "jacobina-saatri", "documentos"]
category: "Feature"
coverImage: "../../assets/blog/montte-nfe.png"
featured: true
readingMinutes: 2
keyTakeaways:
   - "NF-e agora tem uma rota própria no Montte."
   - "O primeiro portal suportado é jacobina-saatri."
   - "A configuração fica em Módulos, dentro das configurações do espaço."
   - "NF-e vai entrar como Early Access Feature no PostHog enquanto estiver em fase de conceito."
faq:
   - question: "Qual portal de NF-e o Montte suporta agora?"
     answer: "O primeiro portal suportado é jacobina-saatri."
   - question: "Onde configuro o portal de NF-e?"
     answer: "Em Configurações, Módulos, NF-e."
   - question: "A emissão de NF-e já está pronta?"
     answer: "Ainda não. Este corte prepara a rota, tabela, configuração do portal e base fiscal para a emissão e consulta."
---

NF-e precisava virar uma área própria no Montte, não mais um anexo perdido em outra tela.

Esse foi o primeiro corte.

Criamos a rota `/nfe`, o schema `fiscal`, o módulo backend e a configuração do portal em **Configurações > Módulos > NF-e**. A tela principal já segue o padrão operacional do produto: tabela, busca, colunas, paginação e estado vazio.

Ainda não é a emissão completa. É a base para ela.

A NF-e vai entrar como **Early Access Feature** no PostHog enquanto estiver em fase de conceito. Quem ativar sabe que está vendo o começo do fluxo: portal, configuração, tabela e fundação técnica antes da emissão ficar pronta.

## O portal é jacobina-saatri

O primeiro portal suportado é `jacobina-saatri`.

Tínhamos começado com um nome genérico de integração. Estava errado. O nome certo é o nome do pacote, porque é isso que o operador e o código precisam reconhecer quando novos portais entrarem.

Na configuração, o usuário escolhe o portal e informa login, senha e inscrição municipal. Sem campo de URL da API. A biblioteca do portal já sabe isso.

Também cortamos homologação dessa tela. Se alguém está configurando NF-e no produto, a ação padrão é produção.

## A tela de NF-e não vira mural de aviso

Quando o espaço ainda não tem portal configurado, a tela de NF-e abre uma Credenza.

Ela explica o que falta e leva direto para a configuração da NF-e. O aviso não fica preso no topo da tabela, ocupando espaço todo dia.

Depois que o portal estiver configurado, a rota `/nfe` fica limpa para o trabalho real: consultar, acompanhar e emitir nota.

## O que já entrou no produto

Esse corte colocou as peças mínimas no lugar:

- rota **NF-e** no menu principal;
- tabela operacional seguindo o padrão das outras telas;
- rota **Configurações > Módulos > NF-e**;
- schema `fiscal.settings` para credenciais do portal;
- schema `fiscal.nfe_documents` para a lista de notas;
- backend fiscal com `getFiscalSettings`, `updateFiscalSettings` e `listNfe`.

A senha não volta para o cliente. A API só informa se ela já existe.

## O que falta

Agora falta plugar o fluxo real do `jacobina-saatri`.

A próxima etapa é consultar notas no portal, gravar os metadados em `fiscal.nfe_documents` e guardar XML e PDF no Vault. Depois vem emissão própria, sem SaaS fiscal separado.

Esse PR entrega a fundação: rota, tabela, portal configurável, credenciais em produção e base fiscal no banco.
