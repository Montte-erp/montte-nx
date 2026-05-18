---
name: Montte
description: Plataforma operacional brasileira para financeiro, serviços e cobranças recorrentes.
colors:
  background: "oklch(0.9751 0.0127 244.2507)"
  foreground: "oklch(0.3729 0.0306 259.7328)"
  card: "oklch(1 0 0)"
  primary: "oklch(0.7227 0.192 149.5793)"
  primary-foreground: "oklch(1 0 0)"
  secondary: "oklch(0.9514 0.025 236.8242)"
  muted: "oklch(0.967 0.0029 264.5419)"
  muted-foreground: "oklch(0.551 0.0234 264.3637)"
  accent: "oklch(0.9505 0.0507 163.0508)"
  destructive: "oklch(0.6368 0.2078 25.3313)"
  border: "oklch(0.9276 0.0058 264.5313)"
  sidebar: "oklch(0.9514 0.025 236.8242)"
  dark-background: "oklch(0.2077 0.0398 265.7549)"
  dark-card: "oklch(0.2795 0.0368 260.031)"
  dark-primary: "oklch(0.7729 0.1535 163.2231)"
  chart-blue: "oklch(0.65 0.19 250)"
  chart-amber: "oklch(0.72 0.2 55)"
  chart-violet: "oklch(0.6 0.21 285)"
typography:
  display:
    fontFamily: "Sora, ui-sans-serif, system-ui, -apple-system, sans-serif"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "0em"
  headline:
    fontFamily: "Sora, ui-sans-serif, system-ui, -apple-system, sans-serif"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "0em"
  body:
    fontFamily: "Sora, ui-sans-serif, system-ui, -apple-system, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "0em"
  label:
    fontFamily: "Sora, ui-sans-serif, system-ui, -apple-system, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.25
    letterSpacing: "0em"
  mono:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
rounded:
  sm: "calc(0.8rem - 4px)"
  md: "calc(0.8rem - 2px)"
  lg: "0.8rem"
  xl: "calc(0.8rem + 4px)"
spacing:
  2: "0.5rem"
  4: "1rem"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.md}"
    padding: "0.5rem 1rem"
  button-secondary:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    padding: "0.5rem 1rem"
  input:
    backgroundColor: "transparent"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    height: "2.25rem"
  card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.lg}"
    padding: "1.5rem"
---

# Design System: Montte

## 1. Overview

**Creative North Star: "Painel Operacional Brasileiro"**

Montte deve parecer um lugar de trabalho confiável para operar dinheiro, clientes, serviços, cobranças e pendências. O sistema visual é contido, claro e utilitário, com superfícies calmas, texto forte o suficiente para guiar escaneamento e uma cor primária verde usada para ação, progresso e confiança.

O produto principal é uma aplicação de dashboard. A landing pode ser mais expressiva, mas ainda precisa mostrar produto e operação concreta. O design rejeita ERP inchado, fintech genérica, grids de cards decorativos e qualquer estética de IA que pareça separada dos dados do negócio.

**Key Characteristics:**

- Interface de trabalho com densidade controlada.
- Verde primário reservado para ação, estado positivo e destaque operacional.
- Tabelas e filtros como superfícies de decisão, não como decoração.
- pt-BR como linguagem nativa da experiência.
- Dark mode funcional, não uma mudança de personalidade.

## 2. Colors

A paleta combina neutros frios de baixa cromaticidade com um verde operacional vivo e cores de apoio para gráficos e categorias.

### Primary

- **Verde Operação** (`oklch(0.7227 0.192 149.5793)`): use em ações primárias, foco, indicadores positivos, receita e pontos de progresso. Em telas densas, ele deve ocupar pouco espaço para manter autoridade.
- **Verde Noturno** (`oklch(0.7729 0.1535 163.2231)`): variação do primary em dark mode, com luminosidade suficiente para foco e ações.

### Secondary

- **Azul Névoa** (`oklch(0.9514 0.025 236.8242)`): camada de sidebar, áreas de suporte e fundos que precisam separar navegação de conteúdo.
- **Menta Suave** (`oklch(0.9505 0.0507 163.0508)`): hover, seleção leve e estados auxiliares que não merecem o peso do primary.

### Tertiary

- **Azul de Métrica** (`oklch(0.65 0.19 250)`): séries de gráfico e comparação.
- **Âmbar de Atenção** (`oklch(0.72 0.2 55)`): avisos, vencimentos e itens que precisam de revisão sem serem erro.
- **Violeta de Segmento** (`oklch(0.6 0.21 285)`): categorias secundárias, nunca como cor dominante da marca.

### Neutral

- **Fundo Frio** (`oklch(0.9751 0.0127 244.2507)`): fundo principal claro.
- **Texto Ardósia** (`oklch(0.3729 0.0306 259.7328)`): texto primário e títulos no tema claro.
- **Superfície Branca** (`oklch(1 0 0)`): cards, popovers e áreas de conteúdo quando precisam de separação limpa.
- **Linha Fria** (`oklch(0.9276 0.0058 264.5313)`): bordas, divisórias e contornos de input.
- **Noite Azulada** (`oklch(0.2077 0.0398 265.7549)`): fundo principal do dark mode.

### Named Rules

**The One Operational Accent Rule.** Verde é ação, progresso ou estado positivo. Não use verde como textura decorativa em toda a tela.

**The Money Status Rule.** Receita, despesa, pendência e ignorado nunca dependem só de cor. Combine cor com texto, ícone, posição ou status.

## 3. Typography

**Display Font:** Sora, com fallback system-ui.
**Body Font:** Sora, com fallback system-ui.
**Label/Mono Font:** ui-monospace para códigos, rotas, chaves e valores técnicos.

**Character:** Sora dá ao produto uma voz técnica e humana sem parecer corporativa demais. A hierarquia deve favorecer leitura rápida e rótulos fortes, não títulos gigantes dentro do app.

### Hierarchy

- **Display** (600, 3rem a 6rem, line-height 1): uso restrito à landing e hero visual.
- **Headline** (600, 1.5rem a 2.25rem, line-height 1.15): títulos de páginas, blocos de landing e estados vazios importantes.
- **Title** (600, 1rem a 1.25rem, line-height 1.25): títulos de painéis, cards, sheets e seções de formulário.
- **Body** (400, 1rem, line-height 1.5): texto de leitura, descrições e conteúdo de formulário. Prosa longa deve ficar entre 65 e 75 caracteres por linha.
- **Label** (500, 0.875rem, letter-spacing 0em): botões, campos, tabs, filtros e cabeçalhos compactos.

### Named Rules

**The Dashboard Type Rule.** Dentro do app, títulos grandes demais reduzem a área de trabalho. Use escala compacta e contraste por peso.

**The Serif Boundary Rule.** Lora é permitido em superfícies editoriais ou landing quando houver intenção clara. No dashboard autenticado, use Sora.

## 4. Elevation

Montte usa profundidade baixa. A separação primária vem de bordas, fundos tonais e arredondamento; sombra aparece para elementos sobrepostos, hover discreto, sheets, popovers e mockups da landing.

### Shadow Vocabulary

- **Subtle Surface** (`0px 4px 8px -1px hsl(0 0% 0% / 0.05)`): inputs, botões outline e pequenas superfícies.
- **Raised Surface** (`0px 4px 8px -1px hsl(0 0% 0% / 0.1), 0px 1px 2px -2px hsl(0 0% 0% / 0.1)`): cards e superfícies que precisam se destacar de uma camada próxima.
- **Overlay Surface** (`0px 4px 8px -1px hsl(0 0% 0% / 0.25)`): sheets, popovers grandes, mockups e elementos acima do app.

### Named Rules

**The Flat First Rule.** Uma superfície parada deve se sustentar por layout, borda e tom. Use sombra quando houver sobreposição ou mudança de estado.

## 5. Components

### Buttons

- **Shape:** rounded-md, derivado de `--radius`.
- **Primary:** fundo Verde Operação, texto primary-foreground, gap 2 e ícone de 16px quando houver.
- **Hover / Focus:** hover reduz opacidade do fundo; foco usa ring de 3px em `ring/50`.
- **Secondary / Ghost / Outline:** secondary usa fundo Azul Névoa; ghost só colore no hover; outline mantém borda e sombra baixa.
- **Icon Buttons:** tamanhos fixos de 24, 32, 36 ou 40px, com tooltip quando o ícone não for óbvio.

### Chips

- **Style:** arredondados, compactos, com fundo tonal ou borda sutil.
- **State:** selecionado pode usar accent ou primary em baixa opacidade. Filtros removíveis devem ter affordance clara e rótulo em pt-BR.

### Cards / Containers

- **Corner Style:** rounded-lg para cards e rounded-xl para frames maiores do shell.
- **Background:** cards usam `card`; sidebars e faixas usam `sidebar` ou `secondary`.
- **Shadow Strategy:** shadow-sm por padrão, shadow-xl apenas para overlays e landing mocks.
- **Border:** borda fina em `border`; nunca use faixa lateral colorida como assinatura visual.
- **Internal Padding:** use principalmente `p-4` no app e `p-6` em cards compartilhados.

### Inputs / Fields

- **Style:** altura 36px, border-input, fundo transparente e rounded-md.
- **Focus:** border-ring com ring de 3px em `ring/50`.
- **Error / Disabled:** erro usa destructive em borda e ring; disabled reduz opacidade e bloqueia eventos.

### Navigation

- **Sidebar:** camada própria em `sidebar`, com o conteúdo principal arredondado sobre ela.
- **Headers:** páginas autenticadas devem usar o padrão de `DefaultHeader` e `PageHeader`, com ações alinhadas ao topo.
- **Context Panel:** painel lateral direito é ferramenta de contexto, não modal. Deve preservar a tarefa principal visível.
- **Footer Actions:** ações recorrentes e Montte AI podem viver no footer do shell quando forem globais.

### Data Tables

- **Density:** linhas compactas, seleção explícita, ações em lote e filtros persistidos por URL.
- **Headers:** labels curtos, alinhamento por tipo de dado e column meta preenchido.
- **Pinned Columns:** use sombra inset discreta para indicar fixação.
- **Empty / Loading:** use skeleton e o componente Empty. Não use spinner isolado em área principal.

### Sheets and Dialogs

- **Forms:** fluxos de formulário usam `useSheet`.
- **Destructive Confirmation:** use `useAlertDialog`.
- **Other Modal Flows:** use `useCredenza` quando a interrupção for justificada.

## 6. Do's and Don'ts

### Do

- Escreva toda copy de produto em pt-BR.
- Use **Centro de Custo** como nome visível para tags.
- Prefira tabelas, filtros e ações em lote para fluxos operacionais.
- Use verde primário com parcimônia e intenção.
- Preserve foco visível e labels explícitos em todos os campos.
- Mostre estado com texto, ícone e cor juntos.
- Use motion curta, entre 150ms e 250ms, para comunicar estado.

### Don't

- Não transforme dashboards em grids de cards decorativos.
- Não use gradiente em texto.
- Não use glassmorphism como padrão do app.
- Não use faixas laterais coloridas em cards, listas ou alertas.
- Não coloque cards dentro de cards.
- Não introduza outro vocabulário visual para botões, inputs ou tabelas.
- Não use serif em labels, botões, tabelas ou navegação autenticada.
- Não esconda ações críticas em modais quando uma ação inline ou sheet resolver melhor.
