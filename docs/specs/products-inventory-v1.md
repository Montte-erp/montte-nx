# Produtos e Estoque V1

Ultima atualizacao: 2026-05-20

## Objetivo

Criar um modulo simples de produtos fisicos com controle de estoque, integrado ao financeiro e preparado para leitura pelo Montte AI.

A V1 deve responder tres perguntas sem transformar o Montte em um ERP inchado:

- O que existe em estoque?
- Quanto isso vale?
- O que precisa de acao?

## Principios

- Produto nesta V1 significa produto fisico.
- Estoque e uma capacidade do modulo de produtos, nao um modulo separado.
- As acoes operacionais continuam manuais.
- Montte AI apenas le, explica, cruza dados e sugere proximos passos.
- Entrada e saida de estoque podem criar lancamentos financeiros simples.
- A UX deve parecer uma planilha operacional confiavel, com calculos guiados.
- O escopo deve evitar compras, pedidos, fornecedores, fiscal, lotes e multi-deposito.

## Fora Do Escopo Da V1

- Billing products, planos, beneficios, meters, usage e entitlements.
- Fornecedores como entidade.
- Pedido de compra.
- Pedido de venda.
- Cliente obrigatorio na saida.
- Nota fiscal.
- Lote, validade, numero de serie, variacoes e grade.
- Multi-deposito, localizacao de estoque e transferencia entre locais.
- Reserva de estoque.
- Custo medio contabil avancado.
- IA criando, editando ou ajustando registros.

## Modelo Mental

O usuario cadastra produtos fisicos e registra manualmente entradas, saidas e ajustes.

O sistema calcula saldo e valor em estoque a partir das movimentacoes. Quando uma entrada ou saida tem reflexo financeiro, o usuario pode criar o lancamento no financeiro no mesmo fluxo.

O Montte AI usa esses dados para explicar, priorizar e apontar inconsistencias, mas nao executa mutacoes na V1.

## Modulo

Modulo proposto:

```text
modules/products
```

Responsabilidades:

- CRUD de produtos fisicos.
- Registro de entrada, saida e ajuste.
- Calculo de saldo e valor em estoque.
- Integracao simples com lancamentos financeiros.
- Consultas read-only para Montte AI.

## Navegacao

Rotas propostas:

```text
/$slug/$teamSlug/produtos
/$slug/$teamSlug/produtos/$productId
```

Se o padrao atual do app mantiver rotas dentro de `_dashboard`, seguir a convencao existente do repo no momento da implementacao.

## Produto

Campos da V1:

| Campo | Obrigatorio | Observacoes |
|---|---:|---|
| Nome | Sim | Nome visivel do produto. |
| SKU | Nao | Codigo interno simples. Deve ser unico por time quando preenchido. |
| Custo unitario | Nao | Usado como sugestao inicial e atualizado por entradas. |
| Preco de venda | Nao | Usado como sugestao em saidas com receita. |
| Estoque minimo | Nao | Default `0`. Usado para alertas. |
| Categoria | Nao | Categoria financeira padrao. |
| Centro de Custo | Nao | Centro de Custo padrao. |
| Status | Sim | `active` ou `archived`. |

Nao existe campo de unidade na V1. O estoque e contado sempre em unidades inteiras.

## Movimentacoes

Tipos:

```text
entrada
saida
ajuste
```

Regras gerais:

- Toda movimentacao pertence a `organizationId` e `teamId`.
- Toda movimentacao registra o usuario que criou.
- Quantidade de estoque e sempre inteira.
- Saldo nao pode ficar negativo.
- Produto com movimentacao nao deve ser excluido, apenas arquivado.
- Ajuste manual exige motivo.
- Movimentacoes ficam no historico do produto e podem ser consultadas pela IA.

## Entrada Inteligente

Entrada e o fluxo mais importante da V1. Deve permitir registrar compras sem exigir que o usuario faca conta fora do Montte.

### Modo Unidades Diretas

Copy sugerida:

```text
Comprei [144] unidades por [R$ 600,00] no total.

= R$ 4,17 por unidade
```

Campos:

- Produto.
- Quantidade em unidades.
- Valor total.
- Data.
- Observacao opcional.
- Criar lancamento no financeiro.

### Modo Embalagem

Copy sugerida:

```text
Comprei [12] [caixas]
com [12] unidades por caixa
por [R$ 50,00] cada caixa

= 144 unidades no estoque
= R$ 600,00 total
= R$ 4,17 por unidade
```

Campos:

- Produto.
- Quantidade de embalagens.
- Tipo de embalagem.
- Unidades por embalagem.
- Valor por embalagem.
- Data.
- Observacao opcional.
- Criar lancamento no financeiro.

Tipos de embalagem sugeridos:

```text
caixa
pacote
fardo
kit
unidade
outro
```

O tipo de embalagem e apenas contexto de compra. O saldo sempre entra em unidades.

### Integracao Financeira Na Entrada

Quando o usuario marcar `Criar despesa no financeiro`, a entrada cria tambem um lancamento em `transactions`.

Campos financeiros:

- Conta bancaria ou cartao.
- Status: pago ou pendente.
- Vencimento, se pendente.
- Categoria.
- Centro de Custo.
- Descricao.

Defaults inteligentes:

- Tipo do lancamento: despesa.
- Valor: custo total da entrada.
- Categoria: categoria padrao do produto, se existir.
- Centro de Custo: Centro de Custo padrao do produto, se existir.
- Descricao: `Compra de estoque - <nome do produto>`.

Ao salvar:

- cria `stock_movements` com `type = in`;
- cria `transactions` se marcado;
- grava `transactionId` na movimentacao;
- atualiza o custo unitario sugerido do produto com o custo unitario da entrada.

## Saida Integrada Ao Financeiro

Saida reduz o estoque e pode criar um lancamento financeiro simples.

Nao cria cliente, pedido, fatura ou cobranca na V1.

Campos principais:

- Produto.
- Quantidade em unidades.
- Motivo.
- Data.
- Observacao opcional.

Motivos:

```text
venda
uso interno
perda
devolucao
outro
```

Bloco financeiro:

- Criar lancamento no financeiro.
- Tipo: receita ou despesa.
- Conta bancaria ou cartao.
- Status: pago ou pendente.
- Vencimento, se pendente.
- Valor total.
- Categoria.
- Centro de Custo.
- Descricao.

Defaults inteligentes:

- Motivo `venda`: sugere receita.
- Motivo `perda`: sugere nao criar lancamento.
- Motivo `uso interno`: sugere nao criar lancamento.
- Motivo `devolucao`: nao automatiza tipo financeiro; usuario escolhe.
- Valor sugerido: quantidade vezes preco de venda.
- Categoria e Centro de Custo: valores padrao do produto.
- Descricao: `Saida de estoque - <nome do produto>`.

Ao salvar:

- cria `stock_movements` com `type = out`;
- cria `transactions` se marcado;
- grava `transactionId` na movimentacao;
- bloqueia se o saldo ficaria negativo.

Se a saida deixar o produto abaixo do estoque minimo, a UI deve avisar antes da confirmacao.

## Ajuste

Ajuste corrige o saldo quando o estoque real diverge do sistema.

UX recomendada:

```text
Saldo correto agora e [120] unidades.
Motivo: [contagem fisica]
```

O sistema calcula a diferenca.

Exemplo:

- saldo atual: 132
- saldo correto: 120
- movimentacao registrada: ajuste de `-12`

Regras:

- Motivo obrigatorio.
- Nao cria lancamento financeiro na V1.
- Registra usuario, data e saldo anterior.
- Aparece em relatorios e pode ser analisado pela IA.

## Dados

Tabelas propostas:

```text
products
stock_movements
```

### products

```text
id
organization_id
team_id
name
sku
sale_price
unit_cost
minimum_stock
category_id
tag_id
status
created_at
updated_at
```

Indices e constraints:

- `products_team_id_idx`
- `products_team_id_status_idx`
- `products_team_id_name_idx`
- unique parcial para `(team_id, sku)` quando `sku` nao for nulo

### stock_movements

```text
id
organization_id
team_id
product_id
type
quantity_units
previous_quantity_units
resulting_quantity_units
package_quantity
package_type
units_per_package
package_unit_cost
unit_cost
total_amount
financial_amount
reason
transaction_id
occurred_at
created_by_user_id
created_at
```

Observacoes:

- `quantity_units` pode ser positivo ou negativo conforme o tipo.
- Entrada grava quantidade positiva.
- Saida grava quantidade negativa.
- Ajuste grava a diferenca entre saldo anterior e saldo correto.
- `previous_quantity_units` e `resulting_quantity_units` facilitam auditoria e UX.
- Campos de embalagem sao opcionais e usados apenas na entrada inteligente.
- `transaction_id` e opcional.

Indices:

- `stock_movements_team_id_idx`
- `stock_movements_product_id_idx`
- `stock_movements_occurred_at_idx`
- `stock_movements_transaction_id_idx`

## Calculos

Saldo atual:

```text
soma(quantity_units) por product_id
```

Valor em estoque:

```text
saldo atual * unit_cost do produto
```

Custo unitario da entrada direta:

```text
valor total / quantidade em unidades
```

Custo unitario da entrada por embalagem:

```text
valor por embalagem / unidades por embalagem
```

Total da entrada por embalagem:

```text
quantidade de embalagens * valor por embalagem
```

Unidades recebidas por embalagem:

```text
quantidade de embalagens * unidades por embalagem
```

## UI

### Listagem De Produtos

Rota:

```text
/produtos
```

Componentes:

- `DefaultHeader` ou padrao equivalente vigente.
- DataTable do `@packages/ui/components/data-table`.
- Estado de filtros, sort, paginacao e selecao persistido na URL.
- Empty state com CTA para criar produto.

Colunas:

- Produto.
- SKU.
- Saldo.
- Estoque minimo.
- Custo unitario.
- Preco de venda.
- Valor em estoque.
- Centro de Custo.
- Status.

Filtros:

- Busca por nome ou SKU.
- Status.
- Estoque baixo.
- Categoria.
- Centro de Custo.

Acoes:

- Novo produto.
- Entrada.
- Saida.
- Ajuste.
- Arquivar.
- Exportar CSV.

### Detalhe Do Produto

Conteudo:

- Saldo atual.
- Estoque minimo.
- Valor em estoque.
- Custo unitario.
- Preco de venda.
- Historico de movimentacoes.
- Lancamentos financeiros vinculados.
- Alertas e insights read-only.

### Sheets

Sheets da V1:

- Novo produto.
- Editar produto.
- Entrada inteligente.
- Saida.
- Ajuste.

Todos os forms devem usar TanStack Form e `useSheet`.

## Estados E Mensagens

Mensagens visiveis ficam em pt-BR.

Exemplos:

- `Produto criado.`
- `Entrada registrada.`
- `Saida registrada.`
- `Ajuste registrado.`
- `Saldo insuficiente para registrar esta saida.`
- `Informe um motivo para ajustar o estoque.`
- `Esta saida deixara o produto abaixo do estoque minimo.`
- `Nao foi possivel criar o lancamento financeiro.`

Quando a criacao do lancamento financeiro falhar, a movimentacao nao deve ficar parcialmente salva. Entrada/saida com financeiro deve ser uma transacao unica no banco.

## Montte AI V1

Montte AI so pode ler e gerar inteligencia em cima de acoes manuais.

Nao pode:

- criar produto;
- editar produto;
- registrar entrada;
- registrar saida;
- registrar ajuste;
- arquivar produto;
- criar lancamento financeiro.

Pode:

- listar produtos;
- consultar saldo;
- explicar variacao de estoque;
- explicar variacao de custo;
- identificar produtos abaixo do minimo;
- calcular valor total em estoque;
- apontar produtos com maior saida;
- cruzar compras de estoque com despesas;
- destacar ajustes incomuns;
- sugerir reposicao.

Ferramentas read-only propostas:

```text
list_products
get_product
list_stock_movements
get_inventory_summary
list_low_stock_products
get_product_financial_context
```

Exemplos de perguntas suportadas:

- `Quais produtos estao abaixo do minimo?`
- `Quanto dinheiro tenho parado em estoque?`
- `Quais produtos mais sairam este mes?`
- `Por que o custo do Cafe Capsula subiu?`
- `Quais compras de estoque foram lancadas no financeiro este mes?`
- `Tem algum ajuste estranho no estoque?`

## Inbox E Insights

Alertas V1:

- Produto abaixo do estoque minimo.
- Produto sem custo unitario e com saldo positivo.
- Ajuste manual alto em relacao ao saldo.
- Produto com saida recorrente e saldo baixo.

Insights V1:

- Valor total em estoque.
- Produtos abaixo do minimo.
- Entradas por mes.
- Saidas por mes.
- Top produtos por saida.
- Compras de estoque vinculadas ao financeiro.

## Integracoes

### cashbook

Entrada pode criar despesa.

Saida pode criar receita ou despesa simples, conforme escolha do usuario.

O vinculo fica em `stock_movements.transaction_id`.

### classification

Produto pode carregar categoria e Centro de Custo padrao.

Esses valores sao sugeridos em lancamentos financeiros criados a partir de entrada ou saida.

### agents

Montte AI recebe ferramentas read-only do modulo de produtos.

As ferramentas devem respeitar `organizationId`, `teamId` e permissoes do contexto.

### inbox

Regras simples podem gerar pendencias a partir de baixo estoque e ajustes incomuns.

### insights

Relatorios podem agregar produtos, movimentos e transacoes vinculadas.

## Contratos De Router

Routers propostos:

```text
products.getAll
products.getById
products.create
products.update
products.archive
products.getSummary
stockMovements.getAll
stockMovements.createEntry
stockMovements.createExit
stockMovements.createAdjustment
```

Regras de implementacao:

- Routers consultam `context.db` diretamente.
- Escritas usam `db.transaction`.
- Ownership via middleware por `teamId`.
- Falhas esperadas usam `better-result` com `TaggedError` local.
- Mensagens de erro em pt-BR.
- Bulk actions devem ser procedures dedicadas se entrarem depois.

## Permissoes E Auditoria

Toda escrita deve registrar:

- `organizationId`;
- `teamId`;
- usuario criador;
- data da ocorrencia;
- data de criacao;
- origem manual.

Auditoria minima:

- Produto arquivado preserva historico.
- Movimentacao nao deve ser editada silenciosamente.
- Correcao de saldo deve acontecer via nova movimentacao de ajuste.

## Importacao CSV

Importacao fica fora da primeira entrega se o escopo precisar ser menor.

Quando entrar, deve suportar:

- importar produtos;
- importar entradas iniciais;
- pre-visualizar erros antes de confirmar;
- criar apenas registros validos depois da confirmacao.

Nao deve usar loop de `mutateAsync` no client. Deve existir procedure bulk no servidor.

## Fases

### Fase 1 - Base

- Schemas `products` e `stock_movements`.
- Relations.
- `modules/products`.
- Routers CRUD de produto.
- Routers de entrada, saida e ajuste.
- Calculo de saldo.

### Fase 2 - UI Operacional

- Rota `/produtos`.
- DataTable.
- Sheets de produto, entrada, saida e ajuste.
- Detalhe do produto.

### Fase 3 - Financeiro

- Entrada criando despesa opcional.
- Saida criando lancamento opcional.
- Vinculo `transactionId`.
- Historico financeiro no detalhe do produto.

### Fase 4 - Inbox E Insights

- Baixo estoque.
- Valor total em estoque.
- Produtos com maior saida.
- Ajustes incomuns.

### Fase 5 - Montte AI Read-Only

- Ferramentas read-only.
- Resumos e explicacoes.
- Sugestoes sem mutacao.

## Validacao Esperada Na Implementacao

Comandos focados esperados:

```bash
bun nx run @core/database:typecheck
bun nx run @modules/products:typecheck
bun nx run @modules/products:test
bun nx run web:typecheck
bun nx run @modules/products:check
git diff --check
```

Se a implementacao alterar schema:

```bash
bun --filter @core/database build
bun run db:push
```

## Criterios De Aceite

- Usuario cadastra um produto fisico sem preencher campos desnecessarios.
- Usuario registra entrada direta em unidades.
- Usuario registra entrada por embalagem e ve os calculos antes de salvar.
- Entrada pode criar despesa no financeiro em uma unica transacao.
- Usuario registra saida e o saldo reduz.
- Saida pode criar lancamento financeiro simples em uma unica transacao.
- Usuario registra ajuste informando o saldo correto e um motivo.
- Sistema bloqueia saldo negativo.
- Produto abaixo do minimo fica claro na listagem.
- Detalhe do produto mostra historico de movimentacoes e lancamentos vinculados.
- Montte AI responde perguntas read-only sobre estoque sem executar acoes.

