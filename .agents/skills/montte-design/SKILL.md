---
name: montte-design
description: Aplica o design system, produto e padroes de UI do Montte para dashboards, landing, tabelas, forms, sheets e superficies autenticadas. Use ao criar ou revisar UI, UX, copy de produto, layout, componentes, estados visuais ou design de telas no Montte.
---

# Montte Design

Use esta skill antes de criar ou revisar qualquer interface do Montte.

## Leia primeiro

Carregue estes arquivos conforme a tarefa:

- `../../../PRODUCT.md`: posicionamento, publico, escopo, voz e principios do produto.
- `../../../DESIGN.md`: tokens, cores, tipografia, componentes e regras visuais.
- `../../../AGENTS.md`: regras tecnicas de UI, forms, tables, routes, Tailwind e componentizacao.

Se a tarefa for so ajuste pequeno de UI, leia `DESIGN.md` e esta skill. Se envolver decisao de produto, nomes visiveis ou escopo, leia tambem `PRODUCT.md`.

## Norte

Montte e uma ferramenta operacional brasileira para financeiro, recorrencia, servicos, cobrancas e pendencias. O app autenticado deve parecer denso, previsivel e confiavel, nao uma landing decorativa.

Priorize:

- operacao antes de ornamento;
- densidade legivel;
- pt-BR nativo;
- tabelas, filtros e acoes em lote para trabalho real;
- estados claros para dinheiro, permissao, erro e pendencia;
- IA dentro do fluxo, nunca como experiencia solta.

## Regras visuais

- Verde e acao, progresso ou estado positivo. Nao use verde como decoracao espalhada.
- Informacao financeira nunca depende so de cor.
- Dentro do app, tipografia compacta. Hero-scale so na landing.
- Dashboard autenticado usa Sora, nao serif.
- Cards nao ficam dentro de cards.
- Nao use glassmorphism, texto com gradiente ou faixas laterais coloridas como assinatura visual.
- Motion serve estado, entre 150ms e 250ms, respeitando `prefers-reduced-motion`.
- Skeleton e Empty para loading/empty; spinner solto na area principal e ultimo recurso.

## Componentes Montte

- Forms em sheet usam `useSheet`.
- Fluxos modais nao-form usam `useCredenza`.
- Confirmacao destrutiva usa `useAlertDialog`.
- Tabelas usam `@packages/ui/components/data-table`, column meta preenchido, URL state e defs memoizados.
- Empty states usam `Empty / EmptyHeader / EmptyMedia / EmptyTitle / EmptyDescription / EmptyContent`.
- Icon buttons precisam dimensao fixa e tooltip quando o icone nao for obvio.
- Use icones existentes da biblioteca do projeto, nao SVG manual quando houver equivalente.

## Tailwind e layout

- Sem margin utilities (`m-`, `mt-`, `mx-`, `space-x-*`, `space-y-*`).
- Use `gap-2` ou `gap-4`.
- Spacing/sizing com sufixos `2` e `4` quando aplicavel.
- Elementos fixos de UI precisam dimensoes estaveis para evitar layout shift.
- Texto nao pode vazar ou sobrepor controles em desktop ou mobile.

## Copy

- Todo texto visivel em pt-BR.
- Tags no produto sao sempre `Centro de Custo`.
- Evite promessa inflada, jargao importado e tom de startup generica.
- Labels devem ser curtos, concretos e alinhados com o trabalho do usuario.

## Checklist antes de fechar

- A tela parece uma ferramenta de trabalho, nao um grid decorativo?
- A hierarquia permite escanear em poucos segundos?
- Estados de hover, focus, disabled, loading, empty e error existem?
- Acoes criticas estao visiveis e previsiveis?
- O layout cabe em mobile sem sobreposicao?
- A copy esta em pt-BR e com termos do Montte?
- O diff respeita `AGENTS.md` para forms, tables, Tailwind e rotas?
