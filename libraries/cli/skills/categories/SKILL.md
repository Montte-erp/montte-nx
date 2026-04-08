---
name: "@montte/cli/categories"
description: >
  Use when managing transaction categories via the montte CLI: listing by type,
  creating parent or subcategories, archiving (soft delete), or permanently removing.
type: sub-skill
library: "@montte/cli"
library_version: "0.1.0"
sources:
  - "Montte-erp/montte-nx:libraries/cli/src/commands/categories.ts"
---

# Categories

## `montte categories list`

List all categories.

```bash
montte categories list
montte categories list --type expense
montte categories list --archived --json
```

| Option | Description |
|--------|-------------|
| `--type <type>` | `income` or `expense` |
| `--archived` | Include archived categories |
| `--json` | Output raw JSON |

Output columns: `id`, `name`, `type`, `level`, `archived`

## `montte categories create`

Create a new category. Supports a parent category for subcategories.

```bash
montte categories create --name "Alimentação" --type expense
montte categories create --name "Restaurantes" --type expense --parent <parent-id> --color "#FF6B35"
```

| Option | Required | Description |
|--------|----------|-------------|
| `--name` | Yes | Category name |
| `--type` | Yes | `income` or `expense` |
| `--parent` | No | Parent category ID (creates a subcategory) |
| `--color` | No | Hex color (e.g. `#FF6B35`) |
| `--json` | No | Output raw JSON |

## `montte categories archive <id>`

Archive a category (soft delete — transactions are preserved).

```bash
montte categories archive cat_abc123
```

## `montte categories remove <id>`

Permanently delete a category.

```bash
montte categories remove cat_abc123
```

## Notes

- Categories have two levels: parent and subcategory (`level` field).
- Archived categories are hidden from the UI but historical transactions retain their category.
