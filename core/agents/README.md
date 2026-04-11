# @core/agents

TanStack AI-powered agent framework with multi-model support via OpenRouter.

## Exports

| Export     | Purpose                                      |
| ---------- | -------------------------------------------- |
| `.`        | `chatRubi()` — streaming chat function       |
| `./models` | Model ID types and available model presets   |
| `./utils`  | Agent utility functions                      |

## Usage

```typescript
import { chatRubi } from "@core/agents";

const stream = chatRubi({
   db,
   userId,
   teamId,
   organizationId,
   threadId,
   messages,
   modelId: "openrouter/moonshotai/kimi-k2.5",
   language: "pt-BR",
});

for await (const chunk of stream) {
   // stream TanStack AI chunks to the client
}
```

## How It Works

`chatRubi()` wraps TanStack AI's `chat()` with an OpenRouter adapter. It builds a system prompt scoped to Rubi's persona, resolves the model preset (temperature, topP, maxTokens), and attaches a persistence middleware that saves user/assistant messages and auto-generates a thread title after the first exchange.
