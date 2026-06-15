---
title: "NF-e no Montte"
description: "O Montte ganhou a primeira tela de NF-e: uma área própria para acompanhar notas, configurar o portal jacobina-saatri e preparar a emissão própria dentro do produto."
publishedAt: 2026-06-15
author: "Manoel Neto"
tags: ["nfe", "fiscal", "jacobina-saatri", "documentos"]
category: "Feature"
coverImage: "../../assets/blog/montte-nfe.png"
featured: true
readingMinutes: 2
keyTakeaways:
   - "NF-e agora tem uma área própria no Montte."
   - "O primeiro portal suportado é jacobina-saatri."
   - "A configuração fica em Configurações, Módulos, NF-e."
   - "NF-e vai entrar como Early Access Feature no PostHog enquanto estiver em fase de conceito."
faq:
   - question: "Qual portal de NF-e o Montte suporta agora?"
     answer: "O primeiro portal suportado é jacobina-saatri."
   - question: "Onde configuro o portal de NF-e?"
     answer: "Em Configurações, Módulos, NF-e."
   - question: "A emissão de NF-e já está pronta?"
     answer: "Ainda não. A NF-e entra primeiro como Early Access Feature em fase de conceito."
---

NF-e ganhou uma área própria no Montte.

Antes de emitir nota, a gente precisava resolver o básico: onde a nota aparece, onde o portal é configurado e o que acontece quando o espaço ainda não tem credenciais fiscais.

Esse PR entrega esse começo.

A tela `/nfe` já segue o padrão das outras áreas do Montte: tabela, busca, colunas, paginação e estado vazio. Não é uma tela final. É o primeiro lugar onde a operação fiscal vai morar.

A NF-e vai entrar como **Early Access Feature** no PostHog enquanto estiver em fase de conceito. Quem ativar vai ver o fluxo nascendo dentro do produto, sem promessa de emissão completa no primeiro dia.

## O primeiro portal é jacobina-saatri

O primeiro portal suportado é `jacobina-saatri`.

Na configuração da NF-e, o usuário escolhe o portal e informa login, senha e inscrição municipal. Só isso.

Não tem campo de URL. A biblioteca do portal já sabe o endpoint.

Também não tem seletor de homologação. Se alguém está configurando NF-e no Montte, o caminho padrão é produção.

## Se não configurou, o Montte avisa

Quando o espaço ainda não tem portal fiscal configurado, a tela de NF-e abre uma Credenza.

Ela diz o que falta e leva direto para **Configurações > Módulos > NF-e**.

A tabela não fica com um aviso fixo no topo. Depois que o portal é configurado, a tela fica limpa para o trabalho de verdade.

## O que entra agora

Este corte entrega:

- área **NF-e** no menu principal;
- configuração do portal em **Módulos > NF-e**;
- suporte inicial ao `jacobina-saatri`;
- credenciais de produção por login e senha;
- tabela preparada para listar notas.

A senha não volta para o navegador. O Montte só mostra que ela já foi configurada.

## Próximo passo

Agora o trabalho sai do esqueleto e vai para o fluxo real do portal.

A gente abriu a issue no DFe Kit para expor consulta e artefatos do `jacobina-saatri`: XML, PDF e metadados da nota. Quando isso entrar, o Montte conecta a tela de NF-e ao portal e passa a salvar os documentos no Vault.

O objetivo continua o mesmo: emissão própria, sem SaaS fiscal separado.
