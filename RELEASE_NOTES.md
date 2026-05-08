# Montte 2026.05.08

Esta release apresenta a **Montte AI** reescrita — respostas em tempo real com streaming, busca na web e integração com serviços. O **Inbox** substitui o dashboard como página principal, reunindo ações pendentes num só lugar. Agora você também pode importar extratos **OFX** e contar com a **auto-categorização** por IA com progresso visual.

## Em destaque

### Montte AI — respostas em tempo real e mais inteligência ([#853](https://github.com/Montte-erp/montte-nx/pull/853), [#854](https://github.com/Montte-erp/montte-nx/pull/854), [#855](https://github.com/Montte-erp/montte-nx/pull/855))

O assistente (antes Rubi) foi reescrito por completo. Respostas aparecem em tempo real com streaming de texto — você lê enquanto a IA pensa, sem esperar o bloco completo. Montte AI agora entende comandos sobre serviços, faz busca na web, sugere ações e mostra o raciocínio em etapas.

![Demo](TODO: gif)

### Inbox — nova página inicial com foco no que importa ([MON-871](https://linear.app/montte/issue/MON-871)) ([#864](https://github.com/Montte-erp/montte-nx/pull/864))

O dashboard /home deu lugar ao Inbox (/inbox). A página reúne lançamentos pendentes, imports recentes e ações prioritárias em um só lugar.

![Demo](TODO: gif)

### Importação OFX e auto-categorização por IA ([MON-585](https://linear.app/montte/issue/MON-585)) ([#840](https://github.com/Montte-erp/montte-nx/pull/840)) ([MON-586](https://linear.app/montte/issue/MON-586)) ([#842](https://github.com/Montte-erp/montte-nx/pull/842))

Importe extratos bancários no formato OFX diretamente no Montte — compatível com Itaú, Santander e outros. A IA categoriza cada lançamento automaticamente e você acompanha o progresso em tempo real.

![Demo](TODO: gif)

## Ação necessária

### /home substituído pelo Inbox ([MON-871](https://linear.app/montte/issue/MON-871)) ([#864](https://github.com/Montte-erp/montte-nx/pull/864))

**Quem é afetado:** Todos os usuários
**O que fazer:** A página inicial /home foi removida e substituída pelo Inbox (/inbox). A navegação pela sidebar já reflete a mudança. Se você tinha /home como favorito, atualize o link para /inbox.

## Novidades por área

### Financeiro
- categorias com suporte hierárquico (pai/filho) ([MON-870](https://linear.app/montte/issue/MON-870)) ([#875](https://github.com/Montte-erp/montte-nx/pull/875))
- tipo "transferência" adicionado às categorias ([MON-866](https://linear.app/montte/issue/MON-866)) ([#874](https://github.com/Montte-erp/montte-nx/pull/874))
- criação de lançamentos por formulário lateral ([#866](https://github.com/Montte-erp/montte-nx/pull/866))
- cadastro completo de contas financeiras com autocomplete ([MON-890](https://linear.app/montte/issue/MON-890)) ([#863](https://github.com/Montte-erp/montte-nx/pull/863))

### Importação e Exportação
- exportação de categorias com nomes e datas personalizados ([#862](https://github.com/Montte-erp/montte-nx/pull/862))
- exportação de membros com formatação pt-BR ([#861](https://github.com/Montte-erp/montte-nx/pull/861))

### Equipe
- convite de membros com fluxo completo de aceitação e ativação da organização ([MON-904](https://linear.app/montte/issue/MON-904)) ([#858](https://github.com/Montte-erp/montte-nx/pull/858))

### Plataforma
- onboarding com seleção de objetivos e multi-produto ([#859](https://github.com/Montte-erp/montte-nx/pull/859))
- upload de avatar do usuário ([#877](https://github.com/Montte-erp/montte-nx/pull/877))
- novas páginas de autenticação renovadas ([#869](https://github.com/Montte-erp/montte-nx/pull/869))

### Landing page
- novo site público do Montte com navegação, tema claro/escuro e hub de dados ([#870](https://github.com/Montte-erp/montte-nx/pull/870), [#846](https://github.com/Montte-erp/montte-nx/pull/846), [#848](https://github.com/Montte-erp/montte-nx/pull/848), [#845](https://github.com/Montte-erp/montte-nx/pull/845), [#847](https://github.com/Montte-erp/montte-nx/pull/847))

## Correções

- popover de filtros em categorias não fecha mais ao alternar opções ([#873](https://github.com/Montte-erp/montte-nx/pull/873))
- tela de importação não exibe mais empty state enquanto lançamentos estão carregados ([#868](https://github.com/Montte-erp/montte-nx/pull/868))
- upload de logo da organização corrigido (erro 500 ao atualizar) ([MON-905](https://linear.app/montte/issue/MON-905)) ([#857](https://github.com/Montte-erp/montte-nx/pull/857))
- inputs de código OTP por email agrupados corretamente ([#849](https://github.com/Montte-erp/montte-nx/pull/849))
- ícones de importar e exportar na ordem correta ([#856](https://github.com/Montte-erp/montte-nx/pull/856))

## Melhorias

- landing page carrega mais rápido com waitlist adiado e fontes pré-conectadas ([#871](https://github.com/Montte-erp/montte-nx/pull/871))
- sidebar com novas cores nos ícones de navegação ([#850](https://github.com/Montte-erp/montte-nx/pull/850))
- layout de cartões de crédito ajustado ([#865](https://github.com/Montte-erp/montte-nx/pull/865))
- seletor de data sem overflow e placeholders encurtados ([#867](https://github.com/Montte-erp/montte-nx/pull/867))

<details>
<summary><strong>Notas técnicas</strong> (para o time)</summary>

- **Nx Cloud:** workspace configurado com cache remoto self-hosted ([#876](https://github.com/Montte-erp/montte-nx/pull/876))
- **Montte AI:** chat migrado para `@assistant-ui/react` com SSE, HTTP streaming e schemas compartilhados ([MON-844](https://linear.app/montte/issue/MON-844)) ([#854](https://github.com/Montte-erp/montte-nx/pull/854)) ([MON-845](https://linear.app/montte/issue/MON-845)) ([#855](https://github.com/Montte-erp/montte-nx/pull/855))
- **Estrutura:** componentes de feedback reorganizados em `-layout/feedback` ([MON-847](https://linear.app/montte/issue/MON-847)) ([#860](https://github.com/Montte-erp/montte-nx/pull/860))
- **Dashboard:** layout realocado para junto da rota como `-layout/` ([#851](https://github.com/Montte-erp/montte-nx/pull/851))
- **Infra:** Dockerfiles de produção + docker-compose.prod para self-host ([MON-576](https://linear.app/montte/issue/MON-576)) ([#838](https://github.com/Montte-erp/montte-nx/pull/838))
- **Agent:** renomeado de Rubi para Montte AI / Agent ([#853](https://github.com/Montte-erp/montte-nx/pull/853))
- **Landing:** hero refatorado com hub de dados e tabs PostHog ([MON-695](https://linear.app/montte/issue/MON-695)) ([#848](https://github.com/Montte-erp/montte-nx/pull/848)) ([MON-694](https://linear.app/montte/issue/MON-694)) ([#847](https://github.com/Montte-erp/montte-nx/pull/847))

</details>

<details>
<summary><strong>Manutenção</strong></summary>

- docs: skill design-md adicionada e documentação atualizada ([#852](https://github.com/Montte-erp/montte-nx/pull/852))
- docs: guia de contribuição revisado ([#839](https://github.com/Montte-erp/montte-nx/pull/839))
- docs: README e CLAUDE.md reescritos ([MON-574](https://linear.app/montte/issue/MON-574)) ([#837](https://github.com/Montte-erp/montte-nx/pull/837))
- ci: workflow de PR readiness com opencode triage ([#844](https://github.com/Montte-erp/montte-nx/pull/844))
- ci: cache bun store, node_modules e Nx via Blacksmith ([#843](https://github.com/Montte-erp/montte-nx/pull/843))
- ci: landing app configurada no Railway ([#841](https://github.com/Montte-erp/montte-nx/pull/841))
- style: ajustes de layout e espaçamento na landing page ([#872](https://github.com/Montte-erp/montte-nx/pull/872))

</details>

---

**Contribuíram nesta release:** @Yorizel
