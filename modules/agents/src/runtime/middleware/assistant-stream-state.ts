import { StreamProcessor, type UIMessage } from "@tanstack/ai";

export type AssistantStreamState = ReturnType<
   typeof createAssistantStreamState
>;

export function createAssistantStreamState(history: UIMessage[]) {
   const processor = new StreamProcessor();
   let traceId: string | undefined;

   return {
      onStart() {
         processor.setMessages(history);
         processor.prepareAssistantMessage();
      },
      processChunk(chunk: Parameters<StreamProcessor["processChunk"]>[0]) {
         if (chunk.type === "RUN_STARTED" && chunk.runId) traceId = chunk.runId;
         processor.processChunk(chunk);
      },
      newAssistantMessages() {
         return processor
            .getMessages()
            .slice(history.length)
            .filter((m) => m.role === "assistant" && m.parts.length > 0);
      },
      messageCount() {
         return processor.getMessages().length;
      },
      traceId() {
         return traceId;
      },
   };
}
