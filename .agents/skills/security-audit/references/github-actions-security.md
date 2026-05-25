# GitHub Actions Security

## CI gate rules

- Não use `pull_request_target` para rodar código da PR com secrets.
- Não exponha `OPENCODE_API_KEY`, cloud creds, deploy tokens ou `GITHUB_TOKEN` write para forks.
- Para slash commands em `issue_comment`, valide permissão do autor (`admin|maintain|write`).
- Faça checkout por SHA resolvido via GitHub API, não por branch controlada pelo atacante.
- Use `persist-credentials: false` quando o job não precisa push.
- Mantenha `permissions` mínimos.

## Shell injection checklist

Fontes não confiáveis:

- PR title/body/branch/head ref.
- Issue/PR comment body.
- Commit message.
- File path vindo da API.
- Workflow inputs livres.

Defesas:

- Passe dados por env vars ou arquivos.
- Use `jq -n --arg/--argjson` para payload JSON.
- Quote sempre: `"$VAR"`.
- Nunca construa `run: some-command $UNTRUSTED` sem validação/quoting.
- Prefira `gh ... --repo "$GH_REPO"` com repo validado.

## Permission review

Questione permissões:

- `contents: write` só para criar commit/tag/release.
- `pull-requests: write` só para comentar/review.
- `issues: write` só para comentar em issue/PR.
- `id-token: write` só quando OIDC é realmente usado.
- `actions: read` só quando consulta runs/logs.

## Findings válidos em workflows

Reporte quando houver:

- Caminho para secrets em PR/fork não confiável.
- Comando shell controlável que executa em runner com token/secrets úteis.
- Escalação de `GITHUB_TOKEN` para write ou OIDC cloud.
- Slash command sem autorização que roda agente com credenciais.
- Artifact/log leak de token, env ou dados sensíveis.

Não reporte só por:

- Workflow manual interno com inputs de maintainer.
- `id-token: write` sem uso explorável e sem checkout/código não confiável.
- Uso de `github.event` quando só é escrito em relatório sem execução.
