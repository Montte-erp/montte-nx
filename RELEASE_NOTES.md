# Montte 2026.05.01

Semana de reestruturação interna: migramos três domínios (financeiro, insights e conta) para uma nova arquitetura de módulos, eliminamos pacotes legados de eventos e analytics, e simplificamos a engine de classificação e faturamento. O chat com a Rubi, agente de IA da plataforma, ganhou respostas em streaming — mais rápidas e fluidas. A funcionalidade de Estoque foi removida.

## Destaques

- Chat com a Rubi agora com respostas em streaming, tornando a interação mais rápida e fluida ([#829](https://github.com/Montte-erp/montte-nx/pull/829))
- Remoção da funcionalidade de Estoque, que estava em acesso antecipado ([#831](https://github.com/Montte-erp/montte-nx/pull/831))
- Reorganização interna dos módulos de financeiro, insights e conta — base estrutural para maior estabilidade em entregas futuras

## Mudanças que quebram compatibilidade

- **Remoção do módulo de Estoque**: a funcionalidade, que estava em acesso antecipado, foi removida por completo. Não há migração automática. Usuários que utilizavam o recurso precisam exportar os dados manualmente. ([#831](https://github.com/Montte-erp/montte-nx/pull/831))

## Novidades

- workflow de release semanal com geração de release notes mais robusta e referência a issues do Linear ([#826](https://github.com/Montte-erp/montte-nx/pull/826))

## Melhorias

- ferramentas do agente Rubi agora utilizam procedimentos oRPC em vez de queries diretas ao banco, garantindo consistência com regras de autorização e validação ([MON-560](https://linear.app/montte/issue/MON-560)) ([#833](https://github.com/Montte-erp/montte-nx/pull/833))

## Notas técnicas

- migração dos domínios de insights, financeiro e conta para `@modules/<domínio>`, com eliminação de repositórios, barrel files e pacotes legados (`@packages/events`, `@packages/analytics`) ([MON-569](https://linear.app/montte/issue/MON-569)) ([#834](https://github.com/Montte-erp/montte-nx/pull/834), [#832](https://github.com/Montte-erp/montte-nx/pull/832), [#830](https://github.com/Montte-erp/montte-nx/pull/830))
- simplificação do módulo de classificação: eliminação de service layer, backfill workflow e barrel files ([MON-561](https://linear.app/montte/issue/MON-561)) ([#828](https://github.com/Montte-erp/montte-nx/pull/828))
- extração da engine de precificação e reorganização dos routers de faturamento, com padronização de schemas Drizzle + Zod ([#822](https://github.com/Montte-erp/montte-nx/pull/822))

## Manutenção

- Release notes da semana anterior geradas automaticamente ([#827](https://github.com/Montte-erp/montte-nx/pull/827))

---

**Contribuíram nesta release:** @Yorizel
