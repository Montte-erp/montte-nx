import type { StreamChunk, UIMessage } from "@tanstack/ai";

type Part = UIMessage["parts"][number];

export interface PartsAccumulator {
   consume(chunk: StreamChunk): void;
   readonly parts: Part[];
   readonly traceId: string | undefined;
}

export function createPartsAccumulator(): PartsAccumulator {
   const parts: Part[] = [];
   const textBuffers = new Map<string, number>();
   const thinkingBuffers = new Map<string, number>();
   const toolCallByCallId = new Map<string, number>();
   let traceId: string | undefined;
   let activeAssistantMessageId: string | undefined;

   const appendText = (messageId: string, delta: string) => {
      const idx = textBuffers.get(messageId);
      if (idx !== undefined) {
         const part = parts[idx];
         if (part?.type === "text") {
            parts[idx] = { ...part, content: part.content + delta };
         }
         return;
      }
      textBuffers.set(messageId, parts.length);
      parts.push({ type: "text", content: delta });
   };

   const appendThinking = (messageId: string, delta: string) => {
      const idx = thinkingBuffers.get(messageId);
      if (idx !== undefined) {
         const part = parts[idx];
         if (part?.type === "thinking") {
            parts[idx] = { ...part, content: part.content + delta };
         }
         return;
      }
      thinkingBuffers.set(messageId, parts.length);
      parts.push({ type: "thinking", content: delta });
   };

   return {
      consume(chunk) {
         switch (chunk.type) {
            case "RUN_STARTED":
               traceId = chunk.runId;
               return;
            case "TEXT_MESSAGE_START":
               if (chunk.role === "assistant") {
                  activeAssistantMessageId = chunk.messageId;
               }
               return;
            case "TEXT_MESSAGE_CONTENT":
               if (chunk.messageId === activeAssistantMessageId) {
                  appendText(chunk.messageId, chunk.delta);
               }
               return;
            case "THINKING_TEXT_MESSAGE_CONTENT":
               appendThinking(chunk.messageId, chunk.delta);
               return;
            case "REASONING_MESSAGE_CONTENT":
               appendThinking(chunk.messageId, chunk.delta);
               return;
            case "TOOL_CALL_START":
               toolCallByCallId.set(chunk.toolCallId, parts.length);
               parts.push({
                  type: "tool-call",
                  id: chunk.toolCallId,
                  name: chunk.toolCallName,
                  arguments: "",
                  state: "input-streaming",
               });
               return;
            case "TOOL_CALL_ARGS": {
               const idx = toolCallByCallId.get(chunk.toolCallId);
               if (idx === undefined) return;
               const part = parts[idx];
               if (part?.type === "tool-call") {
                  parts[idx] = {
                     ...part,
                     arguments: part.arguments + chunk.delta,
                  };
               }
               return;
            }
            case "TOOL_CALL_END": {
               const idx = toolCallByCallId.get(chunk.toolCallId);
               if (idx === undefined) return;
               const part = parts[idx];
               if (part?.type === "tool-call") {
                  parts[idx] = { ...part, state: "input-complete" };
               }
               return;
            }
            case "TOOL_CALL_RESULT": {
               const idx = toolCallByCallId.get(chunk.toolCallId);
               if (idx === undefined) return;
               const part = parts[idx];
               if (part?.type === "tool-call") {
                  parts[idx] = {
                     ...part,
                     state: "input-complete",
                     output: chunk.content,
                  };
               }
               return;
            }
            default:
               return;
         }
      },
      get parts() {
         return parts;
      },
      get traceId() {
         return traceId;
      },
   };
}
