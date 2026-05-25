# Public docs validation

Run these checks after generating docs.

## Required files

The exact content directory can vary, but the default is:

```bash
test -s apps/landing/src/content/docs/index.mdx
test -s apps/landing/src/content/docs/quickstart.mdx
test -s docs/llms.txt
```

## Content checks

- No secrets, tokens, env values or private CI metadata.
- No TODO placeholders in published pages.
- Every page has a clear title and first paragraph.
- Main pages have a quick example or a clear next step.
- Limitations and prerequisites are explicit when relevant.
- Headings are stable and specific enough for retrieval.
- `docs/llms.txt` links to public routes, not internal artifact paths only.

## Commands

```bash
git diff --check -- apps/landing docs .agents .flue
bun run landing:build
```

If the landing docs content collection is not implemented yet, document that `bun run landing:build` cannot validate the new pages until `/docs` exists.
