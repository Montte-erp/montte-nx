import type { UIMessage } from "@tanstack/ai-react";
import type { Outputs } from "@/integrations/orpc/client";

export type ChatThreadListItem = Outputs["threads"]["list"]["threads"][number];
export type ChatThreadSnapshot = Outputs["threads"]["getById"]["thread"];
export type ChatMessage = Outputs["threads"]["getById"]["messages"][number];
export type ChatMessageMetadata = ChatMessage["metadata"];

export interface ChatThread extends ChatThreadListItem {
   suggestions: string[];
}

export interface ChatPageContext {
   route?: string;
   title?: string;
   summary?: string;
   skillHint?: string;
}

export type ChatMessages = UIMessage[];
