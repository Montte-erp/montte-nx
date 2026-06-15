---
title: "NF-e no Montte"
description: "O Montte ganhou a primeira base de NF-e: rota própria, tabela operacional, configuração do portal jacobina-saatri e Credenza automática quando o espaço ainda não tem credenciais fiscais."
publishedAt: 2026-06-15
author: "Manoel Neto"
tags: ["nfe", "fiscal", "jacobina-saatri", "documentos"]
category: "Feature"
coverImage: "../../assets/blog/montte-nfe.png"
featured: true
readingMinutes: 2
keyTakeaways:
   - "NF-e agora tem rota própria no Montte."
   - "O primeiro portal suportado é jacobina-saatri."
   - "A configuração fica em Configurações, Módulos, NF-e."
   - "NF-e vai entrar como Early Access Feature no PostHog enquanto estiver em fase de conceito."
faq:
   - question: "Qual portal de NF-e o Montte suporta agora?"
     answer: "O primeiro portal suportado é jacobina-saatri."
   - question: "Onde configuro o portal de NF-e?"
     answer: "Em Configurações, Módulos, NF-e."
   - question: "A emissão de NF-e já está pronta?"
     answer: "Ainda não. Este corte prepara a rota, a tabela, a configuração do portal e a base fiscal para consulta e emissão."
---

NF-e não cabia como anexo perdido no financeiro.

Ela precisava de uma área própria no Montte, com tabela, busca e configuração fiscal no lugar certo. Começamos por essa base.

Criamos a rota `/nfe`, o schema `fiscal`, o módulo backend e a tela **Configurações > Módulos > NF-e**. A tela principal já usa o mesmo padrão das outras áreas operacionais: tabela, colunas, busca, paginação e estado vazio.

A emissão ainda não está pronta. Essa entrega prepara o chão.

A NF-e vai entrar como **Early Access Feature** no PostHog enquanto estiver em fase de conceito. Quem ativar vai ver o começo do fluxo: portal, credenciais, tabela e fundação técnica antes da emissão completa.

## O primeiro portal é jacobina-saatri

O primeiro portal suportado é `jacobina-saatri`.

A gente começou chamando a integração por um nome genérico. Cortamos. O nome que fica na UI e no banco é o nome do pacote, porque novos portais vão seguir o mesmo padrão.

Na configuração da NF-e, o usuário escolhe o portal e informa login, senha e inscrição municipal. Não tem campo de URL. A biblioteca do portal já conhece o endpoint.

Também removemos homologação da tela. Se alguém está configurando NF-e no produto, o fluxo padrão é produção.

## A tela avisa sem ocupar a tabela

Se o espaço ainda não tem portal configurado, a rota `/nfe` abre uma Credenza.

A Credenza diz o que falta e leva direto para **Configurações > Módulos > NF-e**. A tabela continua limpa. Nada de banner fixo no topo ocupando espaço todo dia.

Depois que o portal estiver configurado, a tela fica pronta para o trabalho real: consultar, acompanhar e emitir nota.

## O que entrou agora

Esse corte colocou as peças mínimas no produto:

- rota **NF-e** no menu principal;
- tabela operacional com o mesmo padrão do Vault e das telas financeiras;
- rota **Configurações > Módulos > NF-e**;
- schema `fiscal.settings` para portal e credenciais;
- schema `fiscal.nfe_documents` para a lista de notas;
- backend fiscal com `getFiscalSettings`, `updateFiscalSettings` e `listNfe`.

A senha não volta para o navegador. O backend só informa se já existe uma senha salva.

## O que vem depois

Agora falta ligar o fluxo real do `jacobina-saatri`.

A próxima etapa é consultar notas no portal, gravar os metadados em `fiscal.nfe_documents` e guardar XML e PDF no Vault. Depois disso vem emissão própria, sem SaaS fiscal separado.

Esse PR entrega a fundação: rota, tabela, portal configurável, credenciais de produção e base fiscal no banco.
