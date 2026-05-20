# Tests And Validation Review

Use para review de testes unitarios, Playwright, fixtures, helpers E2E, CI flakiness e fechamento de validacao.

## Principios

- Teste deve provar o comportamento do finding, nao apenas cobrir linha alterada.
- Validacao focada e preferivel a `bun run typecheck` amplo quando o workspace esta ruidoso.
- Se o patch toca contrato compartilhado, amplie a validacao para consumidores relevantes.
- Separe falha preexistente/ambiente de regressao causada pelo patch.

## E2E

- Se um spec compartilha arrays/estado top-level, use `test.describe.configure({ mode: "serial" })` ou remova compartilhamento.
- Helpers de DB devem rejeitar `DATABASE_URL` remota quando isso protege dados reais; trate esse erro como blocker de ambiente.
- Prefira erro explicito a assertion silenciosa quando o helper falha em setup.
- Nao mascarar flake com timeout aleatorio; estabilize seletor, estado ou espera causal.

## Unit/integration

- Testes de router devem exercitar ownership, not found, conflito e caminho feliz quando o review toca esses ramos.
- Para parsing/importacao, inclua casos de calendario invalido, arredondamento e formato aceito.
- Para ordenacao/paginacao, teste tie-breaker e multi-sort se o bug envolve estabilidade.

## Comandos comuns

- `bun --filter <pkg> test`
- `bun --filter <pkg> typecheck`
- `bunx tsc -p <tsconfig> --noEmit`
- `bunx playwright test -c apps/web-e2e/playwright.config.ts <spec>`
- `bunx oxfmt <arquivos>`
- `git diff --check`

## Fechamento

Liste exatamente o que passou. Se nao rodou algo importante, diga o motivo e o menor proximo comando confiavel.
