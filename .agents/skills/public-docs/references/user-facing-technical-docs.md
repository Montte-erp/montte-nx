# Documentação técnica user-facing

## Princípio central

Toda página pública deve começar fácil para iniciantes, terminar útil para uso real e ser segura para o Montte AI citar.

## Público

As docs têm dois consumidores:

- usuários lendo `/docs` para entender o Montte e resolver tarefas sem suporte;
- Montte AI recuperando seções para responder dúvidas com precisão.

## Modelo de conteúdo

Use Diátaxis como modelo de navegação:

| Tipo       | Pergunta do usuário     | Propósito                                       |
| ---------- | ----------------------- | ----------------------------------------------- |
| Tutorial   | Você pode me ensinar?   | Levar de zero até um resultado claro.           |
| Guia       | Como eu faço X?         | Passos orientados a uma tarefa.                 |
| Referência | Qual é a regra exata?   | Fatos, campos, opções, limites e comportamento. |
| Explicação | Por que funciona assim? | Modelos mentais, contexto e trade-offs.         |

Dentro das páginas, use progressive disclosure:

1. introdução em linguagem simples;
2. exemplo, cenário ou fluxo mínimo;
3. modelo mental;
4. variações práticas;
5. detalhes avançados;
6. próximos passos e links relacionados.

## Tom

- Claro, direto e calmo.
- Amigável, mas não infantil.
- Confiante, mas sem hype.
- Técnico quando necessário, mas nunca abstrato sem necessidade.
- Evite piadas internas, memes e referências culturais.
- Evite dizer que algo é “simples”, “óbvio” ou “fácil” quando a tarefa pode ser difícil.

## Regras para retrieval por IA

- Use headings estáveis e específicos.
- Mantenha seções focadas e pequenas.
- Defina termos uma vez e reutilize os mesmos nomes.
- Deixe pré-requisitos, limites e exceções explícitos.
- Inclua erros comuns e troubleshooting quando relevante.
- Prefira tabelas para opções, permissões, estados e trade-offs.
- Evite linguagem vaga de marketing porque a IA pode repetir como orientação.

## Template de seção

```mdx
# Título da página

Resumo em linguagem simples.

## O que você vai aprender

## Antes de começar

## Exemplo ou fluxo rápido

## Como funciona

## Erros comuns

## Detalhes avançados

## Referência

## Próximos passos
```

Páginas de referência podem ser mais diretas, com campos, estados, permissões, efeitos, erros e guias relacionados.
