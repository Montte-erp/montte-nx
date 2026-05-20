# Documentation Style

Use para todos os arquivos `docs/project`.

## Voz

- pt-BR claro, direto e tecnico.
- Escreva para um dev novo ou agente de IA mantendo o projeto.
- Prefira bullets e tabelas quando reduzem ambiguidade.
- Nomeie paths, comandos, tabelas e routers explicitamente.

## Anti-padroes

- Documentacao generica que serviria para qualquer monorepo.
- Frases como "garante robustez", "melhora a experiencia" sem explicar onde e como.
- Descrever arquitetura desejada como se ja existisse.
- Incluir segredos, tokens, exemplos reais sensiveis ou valores de env.
- Misturar release notes promocional com documentacao operacional.
- Criar secoes vazias com texto decorativo.

## Como lidar com lacuna

Se o contexto nao prova algo, use:

> Nao identificado no contexto coletado.

Se o caminho existe mas a responsabilidade nao esta clara:

> O contexto lista o caminho, mas nao traz detalhe suficiente para descrever o contrato com seguranca.

Nao complete por inferencia arriscada.
