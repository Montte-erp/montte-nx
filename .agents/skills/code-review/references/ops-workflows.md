# Ops, Workflows And Runtime Review

Use para review em `apps/worker`, DBOS, pg-boss, workflows, scripts, CI, release, Docker, dev-init e runtime operacional.

Abra referencias de [implementation](../../implementation/SKILL.md): [dbos](../../implementation/references/dbos.md), [pg-boss](../../implementation/references/pg-boss.md), [better-result](../../implementation/references/better-result.md) ou [evlog](../../implementation/references/evlog.md) conforme o caso.

## DBOS e filas

- `DBOS.logger` fica dentro de workflows DBOS.
- Workflows precisam ser replay-safe: sem side effects fora de steps/transacoes apropriadas.
- Operacoes reexecutaveis precisam de idempotencia ou chave deterministica.
- Jobs recorrentes precisam evitar duplicidade e registrar estado suficiente para retry.
- Nao deixar trabalho inutil dentro de transacao quente.
- Provider calls devem ter erro esperado tipado e logging util, sem payload sensivel.

## CI e release

- Workflow de release usa CalVer `YYYY.MM.DD` e tag `vYYYY.MM.DD`.
- Releases sao do produto unico `apps/web`; nao inferir publicacao de libs.
- Em GitHub Actions acionado por `workflow_run`, checkout deve usar o SHA correto do workflow de origem quando esse e o objetivo.
- Artefatos gerados devem limpar output antigo quando o review aponta stale files.

## Scripts e dev-init

- Para script Bun, diferencie `bun --check` de comandos que executam runtime.
- Se container/doctor falha por ambiente, registre o blocker e valide a sintaxe/build do trecho quando possivel.
- Nunca aumentar `NODE_OPTIONS` como resposta a build lenta ou OOM; investigar causa.

## Validacao comum

- comando focado do script/workflow quando seguro
- `bun build <script> --target=bun --outfile /tmp/<nome>.js` para check rapido de script
- `bun nx run <target> --skipSync`
- `git diff --check`
