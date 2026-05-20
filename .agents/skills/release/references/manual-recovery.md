# Manual Release Recovery

Use quando `RELEASE_NOTES.md` foi gerado, mas tag ou GitHub Release nao foi criada.

## Ordem segura

1. Verifique branch e base remota atual.
2. Verifique se a tag/release ja existe:

```bash
gh release view vYYYY.MM.DD --json tagName,name,url,publishedAt
```

3. Se nao existir, confirme o target correto (`master` ou SHA do workflow).
4. Use as notes ja geradas e validadas:

```bash
gh release create vYYYY.MM.DD --target master --title "Montte YYYY.MM.DD" --notes-file RELEASE_NOTES.md
```

5. Revalide:

```bash
gh release view vYYYY.MM.DD --json tagName,name,url,publishedAt
```

## Cuidados

- Nao crie tag duplicada.
- Nao recrie notes do zero se o artefato valido ja existe.
- Nao incluir mudancas nao relacionadas no commit de recuperacao.
- Se `gh` falhar por DNS/API, reporte como bloqueio externo e mantenha o caminho de retomada.
