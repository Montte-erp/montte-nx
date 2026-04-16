# @tooling/css

Shared Tailwind CSS configuration, global stylesheet, and PostCSS config for the monorepo.

## Exports

| Export             | Purpose                                |
| ------------------ | -------------------------------------- |
| `./globals.css`    | Tailwind stylesheet with custom tokens |
| `./postcss.config` | PostCSS configuration                  |

## Dependencies

- `tailwindcss`
- `@tailwindcss/typography`
- `tw-animate-css`
- `tailwind-scrollbar-hide`

## Usage

Consumed by `apps/web` and `@packages/ui`:

```typescript
import "@tooling/css/globals.css";
```
