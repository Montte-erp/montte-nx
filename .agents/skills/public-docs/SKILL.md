---
name: public-docs
description: Gera e atualiza a documentação pública user-facing usada pela landing /docs e pelo Montte AI como knowledge base confiável.
---

# Public Docs

Use esta skill para gerar ou atualizar documentação pública renderizada em `/docs` e índices consumíveis pelo Montte AI.

## Regra principal

A documentação tem dois consumidores oficiais:

1. usuários humanos que precisam entender o produto e resolver tarefas sozinhos;
2. Montte AI, que usa as mesmas páginas como base confiável para explicar como as coisas funcionam.

Toda página deve começar simples, terminar útil para produção e ser segura para Montte AI citar.

## Referências obrigatórias

Leia antes de escrever:

- [Estratégia editorial](references/user-facing-technical-docs.md)
- [Páginas públicas](references/public-docs-pages.md)
- [Validação](references/public-docs-validation.md)

Leia também o arquivo de contexto informado em `$CONTEXT_FILE` ou nos argumentos da chamada.

## Regras de conteúdo

- Escreva em pt-BR claro, direto e acessível.
- Explique conceitos novos antes de usar detalhe técnico.
- Use progressive disclosure: simples primeiro, técnico depois.
- Inclua exemplos ou fluxos práticos cedo nas páginas principais.
- Use nomes de telas, recursos, comandos e paths reais encontrados no contexto.
- Não invente funcionalidades, planos, permissões, rotas, defaults, arquivos ou comportamento do produto.
- Se algo não estiver confirmado, escreva `Não identificado no contexto coletado.` ou omita.
- Não publique metadados internos de CI, tokens, secrets ou valores reais de env.
- Não transforme docs em marketing; seja claro, prático e confiável.
- Mantenha headings estáveis, específicos e bons para retrieval.
- Atualize o índice LLM-readable junto com as páginas públicas.

## Output permitido

Escreva somente dentro dos caminhos recebidos por argumento:

- diretório público de docs da landing, por exemplo `apps/landing/src/content/docs`;
- índice LLM-readable, por exemplo `docs/llms.txt`.

Não escreva artefatos internos como `documentation-context.md` no diretório público.

## Fechamento

Retorne um resumo curto com:

- páginas criadas/alteradas;
- lacunas relevantes;
- validações recomendadas.
