import { chatRubi } from "@core/agents";
import * as chatRepo from "@core/database/repositories/chat-repository";
import { auth, db } from "@/integrations/singletons";
import { toServerSentEventsResponse } from "@tanstack/ai";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const bodySchema = z.object({
   teamId: z.string().uuid(),
   threadId: z.string().uuid(),
   messages: z.array(z.unknown()),
   model: z.string().optional(),
   thinkingBudget: z.number().int().nonnegative().optional(),
   language: z.string().optional(),
});

async function handle({ request }: { request: Request }) {
   const session = await auth.api.getSession({ headers: request.headers });
   if (!session) return new Response("Unauthorized", { status: 401 });

   const rawBody = await request.json().catch(() => null);
   const parsed = bodySchema.safeParse(rawBody);
   if (!parsed.success) return new Response("Bad Request", { status: 400 });

   const { teamId, threadId, messages, model, language } = parsed.data;
   const userId = session.user.id;

   const thread = await chatRepo.getThreadById(db, threadId);
   if (!thread || thread.resourceId !== `${teamId}:${userId}`) {
      return new Response("Forbidden", { status: 403 });
   }

   const stream = chatRubi({
      db,
      userId,
      teamId,
      organizationId: session.session.activeOrganizationId ?? "",
      threadId,
      messages,
      modelId: model,
      language: language ?? "pt-BR",
   });

   return toServerSentEventsResponse(stream);
}

export const Route = createFileRoute("/api/chat/$")({
   server: {
      handlers: { POST: handle },
   },
});
