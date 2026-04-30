# Montte 2026.04.30

Semana de integracao do painel Rubi AI com suporte a threads e acoes em lote, remodelagem dos modulos de billing e agentes, e diversas correcoes na experiencia de servicos e membros.

## Novidades

- Painel Rubi AI com suporte a threads e painel de chat lateral ([#819](https://github.com/Montte-erp/montte-nx/pull/819))
- Ferramenta advisor e UI de aprovacao em lote integrada ao json-render ([#819](https://github.com/Montte-erp/montte-nx/pull/819))
- Tour guiado in-app para a pagina de servicos ([#817](https://github.com/Montte-erp/montte-nx/pull/817))
- Componente NumberInput ([#816](https://github.com/Montte-erp/montte-nx/pull/816))
- Pagina de convites pendentes e refactor da pagina de membros ([#815](https://github.com/Montte-erp/montte-nx/pull/815))
- Acoes em lote e duplicacao de servicos ([#814](https://github.com/Montte-erp/montte-nx/pull/814))
- Cupons, metricas de uso (meter tracking) e motor de precificacao ([#814](https://github.com/Montte-erp/montte-nx/pull/814))
- Pagina de detalhe do servico e gerenciamento de precos ([#814](https://github.com/Montte-erp/montte-nx/pull/814))
- Animacoes de transicao na barra lateral ([#813](https://github.com/Montte-erp/montte-nx/pull/813))
- API key auth bridge e handler OpenAPI ([#811](https://github.com/Montte-erp/montte-nx/pull/811))
- Modulo de classificacao com catalogo de prompts e seeds proprios ([#811](https://github.com/Montte-erp/montte-nx/pull/811))
- Workflows DBOS de ciclo de vida de faturamento (trial, benefit, period-end) ([#810](https://github.com/Montte-erp/montte-nx/pull/810))
- Pacote @core/sse com scopes, canais, publisher e subscriber ([#811](https://github.com/Montte-erp/montte-nx/pull/811))
- Pacote @core/ai com adaptadores deepseek pro/flash ([#811](https://github.com/Montte-erp/montte-nx/pull/811))
- Singleton server oRPC e createBillableProcedure ([#810](https://github.com/Montte-erp/montte-nx/pull/810))
- Integracao HyprPay Better Auth plugin ([#811](https://github.com/Montte-erp/montte-nx/pull/811))
- Pacote @core/dbos com factory createWorkflowClient ([#810](https://github.com/Montte-erp/montte-nx/pull/810))
- Test helpers compartilhados (createTestContext, mock-dbos, seedTeam/seedUser) ([#810](https://github.com/Montte-erp/montte-nx/pull/810))

## Correcoes

- Calculos de precificacao e fluxo de creditos no billing ([#814](https://github.com/Montte-erp/montte-nx/pull/814))
- Fluxo de erro no convite de membros simplificado ([#815](https://github.com/Montte-erp/montte-nx/pull/815))
- Build roteado via Nx para ordenacao de dependencias web/worker ([#812](https://github.com/Montte-erp/montte-nx/pull/812))
- build deps antes de typecheck/test no CI ([#811](https://github.com/Montte-erp/montte-nx/pull/811))
- Idempotencia, vinculacao de contato e escopo de transacao no billing ([#811](https://github.com/Montte-erp/montte-nx/pull/811))
- RPC e OpenAPI mounts separados para preservar wire format do RPCLink ([#811](https://github.com/Montte-erp/montte-nx/pull/811))
- PeriodEnd formatado como DD/MM/YYYY no email de fatura ([#810](https://github.com/Montte-erp/montte-nx/pull/810))
- Enfileiramento benefit-lifecycle para cada item de servico unico ([#810](https://github.com/Montte-erp/montte-nx/pull/810))
- Alinhamento ClassificationQueueName com padrao value-union BillingQueueName ([#811](https://github.com/Montte-erp/montte-nx/pull/811))
- Uso de context.posthog em vez de deps.posthog no middleware de telemetria ([#810](https://github.com/Montte-erp/montte-nx/pull/810))

## Melhorias

- Observabilidade AI alinhada com PostHog LLM Analytics spec ([#821](https://github.com/Montte-erp/montte-nx/pull/821))
- Arquitetura de agentes achatada para layout module-level ([#821](https://github.com/Montte-erp/montte-nx/pull/821))
- Logging com destino Pino sincrono ([#818](https://github.com/Montte-erp/montte-nx/pull/818))
- Onboarding redirecionado para rota de onboarding ([#818](https://github.com/Montte-erp/montte-nx/pull/818))
- Billing module-level ownership middlewares, remocao da camada de repository ([#810](https://github.com/Montte-erp/montte-nx/pull/810))
- oRPC server reescrito como modulo flat, Stripe removido do auth/context ([#810](https://github.com/Montte-erp/montte-nx/pull/810))
- Workflows de billing migrados para DBOS, removidos pacotes legados stripe/hyprpay ([#820](https://github.com/Montte-erp/montte-nx/pull/820))
- Testes de billing movidos para diretorio __tests__ ([#810](https://github.com/Montte-erp/montte-nx/pull/810))
- withTestTransaction convertido de try/catch para neverthrow ([#810](https://github.com/Montte-erp/montte-nx/pull/810))

## Outros

- Pipeline de libraries removida, adicionada release weekly CalVer ([#825](https://github.com/Montte-erp/montte-nx/pull/825))
- Documentacao de planos de classificacao e design de billing ([#811](https://github.com/Montte-erp/montte-nx/pull/811))
- Scripts seed-addons e setup-stripe removidos ([#820](https://github.com/Montte-erp/montte-nx/pull/820))
- Testes de integracao DBOS com pglite-socket ([#810](https://github.com/Montte-erp/montte-nx/pull/810))
- Cobertura de testes para todos os workflows de billing ([#810](https://github.com/Montte-erp/montte-nx/pull/810))
- Dependencias nao utilizadas removidas ([#820](https://github.com/Montte-erp/montte-nx/pull/820))
