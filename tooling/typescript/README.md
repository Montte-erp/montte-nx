# @tooling/typescript

Shared TypeScript configurations for the monorepo.

## Config Files

| File                    | Purpose                                       |
| ----------------------- | --------------------------------------------- |
| `base.json`             | Base `tsconfig` extended by all layers        |
| `app.json`              | Extends base for `apps/` (React, DOM, JSX)    |
| `core.json`             | Extends base for `core/` (Node, no DOM)       |
| `tsconfig.package.json` | Extends base for `packages/` and `libraries/` |

## Usage

```json
{
  "extends": "@tooling/typescript/core.json"
}
```
