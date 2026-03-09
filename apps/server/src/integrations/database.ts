import { createDb } from "@core/database/client";
import { env } from "@core/environment/server";

export const db = createDb({
   databaseUrl: env.DATABASE_URL,
});

// RAG is now handled by @packages/agents/mastra/rag
