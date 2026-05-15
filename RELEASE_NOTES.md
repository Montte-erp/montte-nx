Agrupamento de lançamentos por data e categoria, identidade visual com logos de bancos e ícones nas categorias, e modelos prontos de importação — esta release torna a navegação financeira mais rápida e a entrada de dados muito mais simples. Categorias padrão agora podem ser arquivadas, editadas e excluídas.

## Em destaque

### Agrupamento de lançamentos por data e categoria ([#928](https://github.com/Montte-erp/montte-nx/pull/928))

A tabela de lançamentos agora permite agrupar linhas por data ou categoria, facilitando a visualização do extrato consolidado sem depender de filtros manuais.

### Logos de bancos e ícones visuais em contas, cartões e categorias ([#908](https://github.com/Montte-erp/montte-nx/pull/908), [#924](https://github.com/Montte-erp/montte-nx/pull/924), [#918](https://github.com/Montte-erp/montte-nx/pull/918))

Logos reais de bancos e bandeiras aparecem nas contas e cartões de crédito. Categorias ganharam ícone e cor, tornando a identificação visual imediata durante o lançamento.

### Modelos de importação prontos para cada entidade ([#909](https://github.com/Montte-erp/montte-nx/pull/909), [#904](https://github.com/Montte-erp/montte-nx/pull/904))

Arquivos modelo de CSV e XLSX estão disponíveis na importação de categorias, contas bancárias, contatos e centros de custo — baixe, preencha e importe sem criar planilhas do zero.

## Ação necessária

### Remoção de Dashboards e Insights ([#911](https://github.com/Montte-erp/montte-nx/pull/911))

**Quem é afetado:** organizações que utilizavam as páginas experimentais de Dashboards ou Insights.
**O que fazer:** essas funcionalidades foram descontinuadas. Os dados das demais áreas do produto não foram afetados.

## Novidades por área

### Financeiro

- edição da conta bancária diretamente na linha de lançamento, sem abrir formulário separado ([#931](https://github.com/Montte-erp/montte-nx/pull/931))
- seletor de categorias com hierarquia visual ao criar lançamento manual ([#897](https://github.com/Montte-erp/montte-nx/pull/897))
- categoria passou a ser obrigatória no novo lançamento ([#926](https://github.com/Montte-erp/montte-nx/pull/926))
- opção de ignorar lançamento substitui "marcar como pago" na ação em massa, útil para extratos com movimentações irrelevantes ([#896](https://github.com/Montte-erp/montte-nx/pull/896), [#906](https://github.com/Montte-erp/montte-nx/pull/906))
- atalho "ver lançamentos" diretamente da conta bancária ([#900](https://github.com/Montte-erp/montte-nx/pull/900))
- reordenação dos campos no formulário de novo lançamento manual ([#888](https://github.com/Montte-erp/montte-nx/pull/888))
- campo contato movido para seção recolhível, deixando o formulário mais enxuto ([#921](https://github.com/Montte-erp/montte-nx/pull/921))

### Cartões e Contas

- criação de cartão de crédito padronizada via painel lateral ([#891](https://github.com/Montte-erp/montte-nx/pull/891))
- seleção manual da bandeira no cadastro do cartão ([#902](https://github.com/Montte-erp/montte-nx/pull/902))
- criação de centro de custo padronizada via painel lateral ([#892](https://github.com/Montte-erp/montte-nx/pull/892))

### Categorias

- edição e exclusão de categorias padrão liberadas ([#881](https://github.com/Montte-erp/montte-nx/pull/881))
- arquivamento de categorias padrão ([#907](https://github.com/Montte-erp/montte-nx/pull/907), [#905](https://github.com/Montte-erp/montte-nx/pull/905))
- busca de categorias corrigida na classificação automática ([#927](https://github.com/Montte-erp/montte-nx/pull/927))

### Plataforma

- upload de avatar do usuário ([#879](https://github.com/Montte-erp/montte-nx/pull/879))
- gestão de times com controle de acesso explícito entre espaços de trabalho ([#914](https://github.com/Montte-erp/montte-nx/pull/914))
- reenvio de convite pendente para membros da organização ([#901](https://github.com/Montte-erp/montte-nx/pull/901))
- seletor de organização corrigido ao trocar entre organizações ([#893](https://github.com/Montte-erp/montte-nx/pull/893))

## Correções

- saldo atual das contas passou a considerar apenas lançamentos pagos, excluindo pendentes ([#923](https://github.com/Montte-erp/montte-nx/pull/923))
- filtro "todos" agora funciona corretamente na visualização de lançamentos ([#925](https://github.com/Montte-erp/montte-nx/pull/925))
- ordenação das colunas corrigida nas tabelas ([#920](https://github.com/Montte-erp/montte-nx/pull/920))
- importação OFX que exibia erro e não salvava lançamentos ([#882](https://github.com/Montte-erp/montte-nx/pull/882))
- parsing de datas corrigido na importação de planilhas ([#919](https://github.com/Montte-erp/montte-nx/pull/919))
- alinhamento da coluna valor ajustado nas tabelas ([#922](https://github.com/Montte-erp/montte-nx/pull/922))
- exportação de cartões de crédito com formato brasileiro ([#895](https://github.com/Montte-erp/montte-nx/pull/895))
- permissão de atualização do tipo de lançamento ([#910](https://github.com/Montte-erp/montte-nx/pull/910))
- tooltips das ações de lançamentos ajustados ([#898](https://github.com/Montte-erp/montte-nx/pull/898))
- coluna de categoria pai removida da tabela, eliminando redundância ([#899](https://github.com/Montte-erp/montte-nx/pull/899))
- foco do campo de busca preservado ao navegar na tabela de centros de custo ([#887](https://github.com/Montte-erp/montte-nx/pull/887))

<details>
<summary><strong>Notas técnicas</strong> (para o time)</summary>

- **DataTable v2:** migração completa da tabela de dados para TanStack Table com slot-based core, sticky footer, redimensionamento, reordenação via DnD, sub-rows e exportação ([#912](https://github.com/Montte-erp/montte-nx/pull/912)); hook de toast com ID fixo ([#917](https://github.com/Montte-erp/montte-nx/pull/917)); refactor dos componentes visuais de categoria ([#929](https://github.com/Montte-erp/montte-nx/pull/929))
- **Montte AI:** ferramentas de serviço removidas do agente ([#913](https://github.com/Montte-erp/montte-nx/pull/913)); middleware de telemetria migrado de PostHog AI para OpenTelemetry ([#883](https://github.com/Montte-erp/montte-nx/pull/883)); propagação de `organizationId` para módulos de agente e classificação ([#883](https://github.com/Montte-erp/montte-nx/pull/883))
- **Infra:** armazenamento de arquivos migrado de MinIO para RustFS ([#880](https://github.com/Montte-erp/montte-nx/pull/880)); cliente S3 migrado para `@aws-sdk/client-s3` ([#880](https://github.com/Montte-erp/montte-nx/pull/880)); Nx Cloud e Blacksmith runners removidos ([#892](https://github.com/Montte-erp/montte-nx/pull/892)); badge "Alpha" e opção de desativar PostHog localmente ([#893](https://github.com/Montte-erp/montte-nx/pull/893))
- **Landing page:** Arcjet e rota de waitlist removidos ([#882](https://github.com/Montte-erp/montte-nx/pull/882)); carrossel animado do hero e consentimento de cookies ([#883](https://github.com/Montte-erp/montte-nx/pull/883))

</details>

<details>
<summary><strong>Manutenção</strong></summary>

- Atualização de configuração PostHog e remoção de variáveis de ambiente obsoletas ([#880](https://github.com/Montte-erp/montte-nx/pull/880))
- Correções em testes E2E de importação e UI ([#903](https://github.com/Montte-erp/montte-nx/pull/903), [#916](https://github.com/Montte-erp/montte-nx/pull/916), [#894](https://github.com/Montte-erp/montte-nx/pull/894))
- Atualização de script de release notes ([#930](https://github.com/Montte-erp/montte-nx/pull/930))

</details>

---

**Contribuíram nesta release:** @Yorizel
