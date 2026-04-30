# @core/database

Drizzle ORM abstraction layer over PostgreSQL. Defines all domain schemas, relationships, and repositories for the ERP system.

## Exports

| Export             | Purpose                                                                                                                                                                                      |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `./client`         | Database instance factory (`createDb()`)                                                                                                                                                     |
| `./schema`         | Aggregated schema exports                                                                                                                                                                    |
| `./schemas/*`      | Individual table schemas (assets, bills, budgets, categories, contacts, credit-cards, dashboards, events, financial-goals, inventory, services, subscriptions, transactions, webhooks, etc.) |
| `./repositories/*` | Data access layer (repository pattern)                                                                                                                                                       |
| `./relations`      | Schema relationship definitions                                                                                                                                                              |
| `./helpers/*`      | Database utilities                                                                                                                                                                           |

## Usage

```typescript
import { createDb } from "@core/database/client";
import { content } from "@core/database/schemas/content";
import { createContent } from "@core/database/repositories/content-repository";
```

## Architecture

- **Schemas** define table structures with Drizzle's `pgTable()` using snake_case column naming
- **Relations** map foreign keys and joins between tables
- **Repositories** encapsulate queries behind functions that accept a `DatabaseInstance` and return typed results, using `AppError` + `propagateError()` for error handling
- **Auth tables** (`user`, `session`, `organization`, `team`, `member`, etc.) are managed by Better Auth and must not be edited directly
