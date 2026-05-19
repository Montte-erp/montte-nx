# Product

## Register

product

## Users

Montte atende empresas brasileiras que vivem de operação recorrente: SaaS, serviços, coworkings, operações B2B e times que precisam controlar clientes, financeiro, cobranças, uso, custos e pendências sem montar uma pilha própria de ferramentas.

O usuário principal é o operador fundador ou o time administrativo que abre o produto para responder perguntas práticas: o que entrou, o que saiu, o que vence, o que precisa ser categorizado, qual cliente ou serviço está fora do combinado, e qual ação operacional deve acontecer agora.

O contexto de uso é trabalho real, muitas vezes com dados sensíveis e pouca tolerância a ambiguidade. A interface precisa ser rápida de escanear, previsível e densa quando necessário.

## Product Purpose

Montte é a camada de billing que falta no SaaS brasileiro: assinatura, uso medido, cobrança e estado do cliente entregues de um jeito que o founder não precise montar um ERP por fora.

A régua interna pra escopo é a mistura de **Autumn + Rillet**:

- **Lado Autumn (dev-facing billing layer):** Customer como primitiva de cobrança, SDK pra plugar em qualquer produto SaaS, `customers.state` agregando assinatura, uso, faturas e status de pagamento numa chamada só. Substitui o trabalho manual de wirear Stripe Billing, Lago, Orb ou planilha caseira.
- **Lado Rillet (founder/ops-facing financial intelligence):** contabilidade e financeiro AI-native, auto-categorização, conciliação, dashboards operacionais. Substitui o reflexo de comprar Omie, Bling ou Conta Azul pra fechar o ciclo.

A direção estratégica é construir infraestrutura de recorrência e pagamentos para o Brasil, com uma experiência operacional que combine controle financeiro, contratos de serviço, uso, cobrança, comunicação e automação assistida. O app atual já entrega a base operacional: dashboard autenticado, transações, contas bancárias, cartões, categorias, Centros de Custo, inbox, relatórios, configurações, API keys e Montte AI. CRM fica fora do escopo do core e vive em integração (Twenty é a primeira da fila).

Sucesso significa que uma empresa consegue entender e operar sua recorrência no mesmo lugar: não apenas emitir cobrança, mas enxergar o efeito operacional, financeiro e de relacionamento por cliente, serviço e time, sem ERP separado.

## Brand Personality

Montte deve soar como uma ferramenta de trabalho brasileira, séria e próxima. A personalidade é:

- **Operacional:** fala do que precisa ser feito, sem abstração vazia.
- **Confiável:** trata dinheiro, clientes e permissões com clareza.
- **Direta:** usa pt-BR simples, com termos que equipes brasileiras realmente usam.

A voz evita exagero de startup, promessa inflada e jargão financeiro importado quando há uma palavra melhor em português.

## Anti-references

Montte não deve parecer:

- ERP genérico inchado, com menus enormes e baixa hierarquia.
- Dashboard decorativo que prioriza gráficos bonitos sobre ação.
- Fintech corporativa azul-marinho e dourada por reflexo de categoria.
- SaaS internacional traduzido às pressas, com termos artificiais para o Brasil.
- Chatbot solto da operação, sem vínculo com dados, permissões e ações reais.
- Landing de hype sobre IA que não mostra o produto ou o caso operacional concreto.

## Design Principles

1. **Operação antes de ornamento.** Toda tela deve ajudar o usuário a decidir ou executar algo. Beleza entra como nitidez, não como distração.
2. **Densidade legível.** Tabelas, filtros, ações em lote e painéis podem ser densos, desde que a hierarquia permita escanear rápido.
3. **Brasil como padrão, não adaptação.** Copy, datas, moeda, CNPJ, contas bancárias, Centros de Custo e regras de cobrança devem nascer em pt-BR.
4. **IA dentro do fluxo.** Montte AI deve operar sobre o mesmo contexto do produto, sem virar uma experiência paralela.
5. **Recorrência é sistema.** Cobrança recorrente não é só checkout: envolve cliente, serviço, uso, benefício, contrato, financeiro, inadimplência e ação.

## Accessibility & Inclusion

O padrão mínimo é WCAG 2.2 AA para contraste, foco visível, navegação por teclado, labels explícitos e mensagens de erro compreensíveis.

Movimento deve comunicar estado, não decorar. Respeite `prefers-reduced-motion` em superfícies com animação. Informação financeira nunca pode depender apenas de cor: use texto, ícones, status ou posição para diferenciar receita, despesa, pendente, ignorado, erro e sucesso.

Textos visíveis ao usuário ficam em pt-BR. A nomenclatura de tags no produto é sempre **Centro de Custo**.
