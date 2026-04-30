import "@/polyfill";

import { chat, toHttpResponse } from "@tanstack/ai";
import { createFileRoute } from "@tanstack/react-router";
import { buildRubiChatArgs } from "@modules/agents/rubi";
import { db, posthog, posthogPrompts } from "@/integrations/singletons";
import { auth } from "@/integrations/singletons";

async function handle({ request }: { request: Request }) {
   const session = await auth.api.getSession({ headers: request.headers });
   if (!session?.user) {
      return new Response("Unauthorized", { status: 401 });
   }
   const organizationId = session.session.activeOrganizationId;
   const teamId = session.session.activeTeamId;
   if (!organizationId || !teamId) {
      return new Response("Forbidden", { status: 403 });
   }

   const body = (await request.json()) as {
      messages?: unknown;
      data?: { pageContext?: unknown; threadId?: string };
   };

   const messages = sanitizeMessages(
      Array.isArray(body.messages) ? body.messages : [],
   );
   const pageContext = (body.data?.pageContext ?? undefined) as
      | { skillHint?: string; route?: string; title?: string; summary?: string }
      | undefined;
   const threadId =
      typeof body.data?.threadId === "string" ? body.data.threadId : undefined;

   const args = await buildRubiChatArgs({
      db,
      prompts: posthogPrompts,
      posthog,
      teamId,
      userId: session.user.id,
      organizationId,
      threadId,
      messages,
      pageContext,
   });

   const abortController = new AbortController();
   request.signal.addEventListener("abort", () => abortController.abort(), {
      once: true,
   });

   const stream = chat({ ...args, abortController });
   return toHttpResponse(stream, { abortController });
}

function isObj(v: unknown): v is Record<string, unknown> {
   return typeof v === "object" && v !== null;
}

function sanitizeMessages(input: unknown[]): unknown[] {
   const out: unknown[] = [];
   const validToolCallIds = new Set<string>();

   for (const msg of input) {
      if (!isObj(msg)) continue;
      const role = msg.role;
      if (role !== "user" && role !== "assistant" && role !== "system") {
         continue;
      }
      const parts = Array.isArray(msg.parts) ? msg.parts : [];
      const cleanParts: unknown[] = [];

      for (const part of parts) {
         if (!isObj(part)) continue;
         const type = part.type;

         if (type === "tool-call") {
            const name =
               (typeof part.toolName === "string" && part.toolName) ||
               (typeof part.name === "string" && part.name) ||
               (isObj(part.function) &&
                  typeof part.function.name === "string" &&
                  part.function.name);
            const id =
               (typeof part.toolCallId === "string" && part.toolCallId) ||
               (typeof part.id === "string" && part.id);
            if (!name || !id) continue;
            validToolCallIds.add(id);
            cleanParts.push(part);
            continue;
         }

         if (type === "tool-result") {
            const id =
               (typeof part.toolCallId === "string" && part.toolCallId) ||
               (typeof part.id === "string" && part.id);
            if (!id || !validToolCallIds.has(id)) continue;
            cleanParts.push(part);
            continue;
         }

         cleanParts.push(part);
      }

      if (cleanParts.length === 0 && role !== "user") continue;
      out.push({ ...msg, parts: cleanParts });
   }

   return out;
}

export const Route = createFileRoute("/api/rubi-chat")({
   server: { handlers: { POST: handle } },
});
