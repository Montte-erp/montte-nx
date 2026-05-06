import type { UIMessage } from "@tanstack/ai";

export type ConversationRow = Pick<UIMessage, "role" | "parts">;

export function messageText(row: ConversationRow): string {
   return row.parts
      .flatMap((part) => (part.type === "text" ? [part.content] : []))
      .join("\n")
      .trim();
}

export function conversationTranscript(rows: ConversationRow[]): string {
   return rows
      .flatMap((row) => {
         const text = messageText(row);
         if (!text) return [];
         return [`${row.role}: ${text}`];
      })
      .join("\n\n");
}

export function hasUserAndAssistantText(rows: ConversationRow[]): boolean {
   const hasUser = rows.some(
      (row) => row.role === "user" && messageText(row).length > 0,
   );
   const hasAssistant = rows.some(
      (row) => row.role === "assistant" && messageText(row).length > 0,
   );
   return hasUser && hasAssistant;
}
