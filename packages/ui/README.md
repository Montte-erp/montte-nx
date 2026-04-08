# @packages/ui

Shared component library, hooks, and styling built on Radix, Tailwind, and CVA.

## Exports

| Export             | Purpose                                                            |
| ------------------ | ------------------------------------------------------------------ |
| `./components/*`   | Radix-based primitives (Button, Dialog, Credenza, DataTable, etc.) |
| `./blocks/*`       | Composite UI blocks                                                |
| `./hooks/*`        | SSR-safe hooks (`useMediaQuery`, `useIsMobile`, `useLocalStorage`) |
| `./lib/*`          | Utility functions (`cn`, formatters)                               |
| `./globals.css`    | Tailwind stylesheet                                                |
| `./postcss.config` | PostCSS configuration                                              |

## Usage

```typescript
import { Button } from "@packages/ui/components/button";
import { DataTable } from "@packages/ui/components/data-table";
import { useIsMobile } from "@packages/ui/hooks/use-mobile";
```

## How It Works

Provides the full design system for the Montte frontend. Components are built on Radix UI with Tailwind CSS styling and CVA variants. Includes SSR-safe wrappers for browser APIs, data visualization (Recharts), markdown rendering, motion animations, and responsive patterns.
