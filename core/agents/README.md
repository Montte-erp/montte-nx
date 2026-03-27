# @packages/agents

Mastra-powered AI agent framework with multi-model support and custom request context.

## Exports

| Export      | Purpose                                                       |
| ----------- | ------------------------------------------------------------- |
| `.`         | `mastra` singleton, `createRequestContext()`, agent registration |
| `./models`  | Model ID types and configuration                              |
| `./utils`   | Agent utility functions                                       |

## Usage

```typescript
import { mastra, createRequestContext } from "@packages/agents";

const agent = mastra.getAgent("rubiAgent");
const context = createRequestContext({
  userId: "user-id",
  brandId: "brand-id",
  writerId: "writer-id",
  model: "openrouter/moonshotai/kimi-k2.5",
  language: "pt-BR",
  writerInstructions: [],
});

const result = await agent.generate("Write about TypeScript", {
  requestContext: context,
});
```

## How It Works

Registers AI agents on a Mastra instance with PostgreSQL vector storage and PostHog observability. The `createRequestContext()` builder scopes requests to a team/org/user with model preferences, temperature tuning, thinking budget, and language settings.
