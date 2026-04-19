# @core/agents

TanStack AI primitives — model registry, PostHog observability middleware, and shared AI infrastructure. Domain-specific AI actions live inside each entity or feature module.

## Exports

| Export        | Purpose                                           |
| ------------- | ------------------------------------------------- |
| `.`           | `chatRubi()` — Rubi chat interface (not yet impl) |
| `./models`    | `AVAILABLE_MODELS`, `getModelPreset`, `ModelId`   |
| `./actions/*` | AI action functions per domain                    |

## Model Registry

```typescript
import { AVAILABLE_MODELS, getModelPreset, DEFAULT_MODEL_ID } from "@core/agents/models";

const preset = getModelPreset(AVAILABLE_MODELS, modelId, DEFAULT_MODEL_ID);
// preset.temperature, preset.maxTokens, preset.label, ...
```

Available models (via OpenRouter):
- `openrouter/moonshotai/kimi-k2.5` — default, Rubi's primary model
- `openrouter/google/gemini-3-flash-preview` — long context (1M tokens)
- `openrouter/openai/gpt-oss-20b` — fast and cheap
- `openrouter/google/gemini-3.1-flash-lite-preview` — ultra-light, free tier

## PostHog AI Middleware

Captures `$ai_generation` events to PostHog for every `chat()` call.

```typescript
import { createPosthogAiMiddleware, type AiObservabilityContext } from "@core/agents/middleware/posthog";

const obs: AiObservabilityContext = {
   posthog,
   distinctId: context.userId,
   promptName: "categorize-transaction",
   promptVersion: 1,
};

chat({
   adapter: openRouterText(modelId),
   messages: [...],
   middleware: [createPosthogAiMiddleware(obs)],
});
```

## AI Actions

All actions use `@tanstack/ai` + `@tanstack/ai-openrouter` with `safeTry` from neverthrow. All return `ResultAsync<T, AppError>`.

| Action | Import | Used by |
|--------|--------|---------|
| `inferCategoryWithAI` | `@core/agents/actions/categorize` | transactions categorization |
| `deriveKeywordsWithAI` | `@core/agents/actions/keywords` | categories keyword derivation |
| `deriveTagKeywordsWithAI` | `@core/agents/actions/keywords-tag` | tags keyword derivation |
| `inferTagWithAI` | `@core/agents/actions/suggest-tag` | transactions tag suggestion |

> In the target modular architecture, actions co-locate with their domains (`entities/categories/ai.ts`, `features/transactions/ai.ts`). The middleware and model registry stay in `core/agents/`.
